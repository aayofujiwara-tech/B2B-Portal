/**
 * ええすまいポータル — Google Apps Script
 *
 * 【使い方】
 * 1. Google スプレッドシートを新規作成し、シート名を「受付ログ」にする
 * 2. 「拡張機能 > Apps Script」を開き、このコードを貼り付ける
 * 3. 「デプロイ > 新しいデプロイ」→ 種類「ウェブアプリ」→ 実行「自分」→ アクセス「全員」で公開
 * 4. 生成されたURLを .env.local の GAS_WEBHOOK_URL に設定する
 *
 * 【シート構成】
 * - 「受付ログ」: 面談予約の受付記録
 * - 「判定ログ」: 全ての判定結果を記録（申込に至らなかったケースも含む）
 * - 「slots」  : 拠点ごとの空室スロットデータ（管理画面から更新）
 */

// =========================================================================
// doGet — GETリクエスト（データ読み込み用）
// =========================================================================
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "";

    if (action === "readSlots") {
      return readSlotsFromSheet();
    }

    if (action === "readAssessmentLogs") {
      return readAssessmentLogsFromSheet();
    }

    if (action === "readReceptionLogs") {
      return readReceptionLogsFromSheet();
    }

    if (action === "readNotificationEmails") {
      return readNotificationEmailsFromSheet();
    }

    return ContentService.createTextOutput(
      JSON.stringify({ error: "unknown action" })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// doPost — POSTリクエスト（データ書き込み・通知用）
// =========================================================================
function doPost(e) {
  try {
    var json = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- スロットデータ書き込み ---
    if (json.type === "writeSlots") {
      writeSlotsToSheet(ss, json.body);
      return ContentService.createTextOutput(
        JSON.stringify({ ok: true })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // --- スロットシート初期化 ---
    if (json.type === "initSlots") {
      initSlotsSheet(ss, json.body);
      return ContentService.createTextOutput(
        JSON.stringify({ ok: true })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // --- 通知先メールアドレス書き込み ---
    if (json.type === "writeNotificationEmails") {
      writeNotificationEmailsToSheet(ss, json.emails || []);
      return ContentService.createTextOutput(
        JSON.stringify({ ok: true })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // --- 判定ログ専用リクエスト ---
    if (json.type === "assessment") {
      recordAssessmentLog(ss, json.body);
      return ContentService.createTextOutput(
        JSON.stringify({ ok: true })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // --- 受付ログ（従来の処理） ---
    var body = json.body;

    // 1. 受付ログシートへ記録
    //    参照用シート（受付ログ）: 直近30件のみ保持
    //    蓄積用シート（受付ログ_履歴）: 全件を末尾に追加
    var RECEPTION_HEADERS = [
      "受付日時",
      "施設名",
      "予約者名",
      "電話番号",
      "メール",
      "第1希望",
      "第2希望",
      "第3希望",
      "確度判定",
      "疾患",
      "ADL",
      "判定補足",
      "備考",
      "リピーター",
    ];

    var sheet = getOrCreateSheet(ss, "受付ログ", RECEPTION_HEADERS);

    var dates = body.preferredDates || [];
    var d1 = dates[0] ? dates[0].date + " " + (dates[0].timeSlot || "指定なし") : "";
    var d2 = dates[1] ? dates[1].date + " " + (dates[1].timeSlot || "指定なし") : "";
    var d3 = dates[2] ? dates[2].date + " " + (dates[2].timeSlot || "指定なし") : "";

    var assessment = body.assessmentResult || {};

    var receptionRowData = [
      new Date(),
      body.facilityName || "",
      body.contactName || "",
      body.phone || "",
      body.email || "",
      d1,
      d2,
      d3,
      assessment.status || "未判定",
      assessment.disease || "",
      assessment.adl || "",
      assessment.reason || "",
      body.notes || "",
      body.isRepeater ? "はい" : "いいえ",
    ];

    // --- 参照用シート（直近30件） ---
    sheet.insertRowAfter(1);
    sheet.getRange(2, 1, 1, receptionRowData.length).setValues([receptionRowData]);
    var receptionLastRow = sheet.getLastRow();
    if (receptionLastRow > 31) {
      sheet.deleteRows(32, receptionLastRow - 31);
    }

    // --- 蓄積用シート（全件保持） ---
    var receptionHistorySheet = getOrCreateSheet(ss, "受付ログ_履歴", RECEPTION_HEADERS);
    receptionHistorySheet.appendRow(receptionRowData);

    // 2. 判定ログシートへの補完記録
    // 判定時に source="direct" で既に記録済みのため、受付時は重複計上を避け
    // 「申込に至った」ことだけを補完する（source="booking_linked"）
    if (assessment && assessment.status) {
      recordAssessmentLog(ss, {
        facilityName: body.facilityName || "",
        result: assessment.status || "",
        disease: assessment.disease || "",
        adl: assessment.adl || "",
        dementiaLevel: assessment.dementiaLevel || "",
        welfare: assessment.welfare || "",
        budget: assessment.budget || "",
        reason: assessment.reason || "",
        isRepeater: body.isRepeater ? "はい" : "いいえ",
        source: "booking_linked",
      });
    }

    // 3. メール送信（「通知設定」シートからメールアドレスを読み取り）
    var recipients = getNotificationEmailsFromSheet_internal(ss);
    if (recipients.length > 0) {
      var subject = json.subject || "【要確認】ええすまいポータル面談受付";
      var emailBody = buildEmailBody(body, dates, assessment);

      recipients.forEach(function (addr) {
        MailApp.sendEmail({
          to: addr,
          subject: subject,
          body: emailBody,
        });
      });
    }

    return ContentService.createTextOutput(
      JSON.stringify({ ok: true })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// slots シート — 読み込み
// =========================================================================
function readSlotsFromSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("slots");

  if (!sheet || sheet.getLastRow() <= 1) {
    // シート未作成またはヘッダーのみ → 空オブジェクトを返す
    return ContentService.createTextOutput(
      JSON.stringify({})
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  var result = {};
  // 1行目はヘッダー → 2行目以降がデータ
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var facilityId = String(row[0] || "").trim();
    if (!facilityId) continue;
    result[facilityId] = {
      totalSlots: Number(row[1]) || 0,
      usedSlots: Number(row[2]) || 0,
      lastReloadDate: String(row[3] || ""),
      lastReloadTimestamp: String(row[4] || ""),
      status: String(row[5]) === "available" ? "available" : "adjusting",
    };
  }

  return ContentService.createTextOutput(
    JSON.stringify(result)
  ).setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// slots シート — 書き込み（全拠点を一括上書き）
// =========================================================================
function writeSlotsToSheet(ss, slotsData) {
  var HEADERS = ["facilityId", "totalSlots", "usedSlots", "lastReloadDate", "lastReloadTimestamp", "status"];
  var sheet = getOrCreateSheet(ss, "slots", HEADERS);

  // 既存データ行をクリア（ヘッダーは保持）
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
  }

  // 全拠点データを書き込み
  var keys = Object.keys(slotsData);
  if (keys.length === 0) return;

  var rows = [];
  for (var i = 0; i < keys.length; i++) {
    var fid = keys[i];
    var config = slotsData[fid];
    rows.push([
      fid,
      config.totalSlots || 0,
      config.usedSlots || 0,
      config.lastReloadDate || "",
      config.lastReloadTimestamp || "",
      config.status || "adjusting",
    ]);
  }
  sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
}

// =========================================================================
// slots シート — 初期化（シート未作成時のみ）
// =========================================================================
function initSlotsSheet(ss, seedData) {
  var HEADERS = ["facilityId", "totalSlots", "usedSlots", "lastReloadDate", "lastReloadTimestamp", "status"];

  // 既に存在する場合はスキップ
  if (ss.getSheetByName("slots")) return;

  var sheet = ss.insertSheet("slots");
  sheet.appendRow(HEADERS);

  if (seedData) {
    var keys = Object.keys(seedData);
    var rows = [];
    for (var i = 0; i < keys.length; i++) {
      var fid = keys[i];
      var config = seedData[fid];
      rows.push([
        fid,
        config.totalSlots || 0,
        config.usedSlots || 0,
        config.lastReloadDate || "",
        config.lastReloadTimestamp || "",
        config.status || "adjusting",
      ]);
    }
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    }
  }
}

// =========================================================================
// 判定ログシート — 読み込み
// =========================================================================
function readAssessmentLogsFromSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("判定ログ");

  if (!sheet || sheet.getLastRow() <= 1) {
    return ContentService.createTextOutput(
      JSON.stringify([])
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  var logs = [];
  // 1行目はヘッダー → 2行目以降がデータ
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rawTimestamp = row[0];
    var isoTimestamp = rawTimestamp instanceof Date
      ? rawTimestamp.toISOString()
      : String(rawTimestamp || "");

    var rawResult = String(row[2] || "");
    var result = mapAssessmentResultToEnum(rawResult);

    logs.push({
      id: "a-" + i,
      timestamp: isoTimestamp,
      disease: String(row[3] || ""),
      adl: String(row[4] || ""),
      dementiaLevel: String(row[5] || ""),
      budget: String(row[7] || ""),
      result: result,
      reason: String(row[8] || ""),
      gender: "",
      timing: "",
    });
  }

  // 新しい順（降順）にソート
  logs.sort(function (a, b) {
    return a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0;
  });

  return ContentService.createTextOutput(
    JSON.stringify(logs)
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 判定結果文字列を enum 値にマッピング
 * GAS書き込み時に "acceptable"/"consultation"/"safety_risk" または
 * 日本語("受入可能"/"要相談"/"要慎重検討")で記録されるため両方に対応
 */
function mapAssessmentResultToEnum(rawResult) {
  var val = String(rawResult || "");
  if (val === "acceptable" || val === "受入可能") return "acceptable";
  if (val === "safety_risk" || val.indexOf("慎重検討") >= 0 || val.indexOf("安全リスク") >= 0) return "safety_risk";
  if (val === "consultation" || val === "要相談") return "consultation";
  return "consultation";
}

// =========================================================================
// 受付ログシート — 読み込み
// =========================================================================
function readReceptionLogsFromSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("受付ログ");

  if (!sheet || sheet.getLastRow() <= 1) {
    return ContentService.createTextOutput(
      JSON.stringify([])
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  var logs = [];
  // 1行目はヘッダー → 2行目以降がデータ
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rawTimestamp = row[0];
    var isoTimestamp = rawTimestamp instanceof Date
      ? rawTimestamp.toISOString()
      : String(rawTimestamp || "");

    // 第1希望から日付と時間を分離（例: "2026-02-20 午前" → date="2026-02-20", time="午前"）
    var pref1 = String(row[5] || "");
    var prefParts = pref1.split(" ");
    var preferredDate = prefParts[0] || "";
    var preferredTime = prefParts.slice(1).join(" ") || "";

    logs.push({
      id: "b-" + i,
      timestamp: isoTimestamp,
      facilityName: String(row[1] || ""),
      contactName: String(row[2] || ""),
      phone: String(row[3] || ""),
      email: String(row[4] || ""),
      preferredDate: preferredDate,
      preferredTime: preferredTime,
      notes: String(row[12] || ""),
    });
  }

  // 新しい順（降順）にソート
  logs.sort(function (a, b) {
    return a.timestamp > b.timestamp ? -1 : a.timestamp < b.timestamp ? 1 : 0;
  });

  return ContentService.createTextOutput(
    JSON.stringify(logs)
  ).setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// 共通ヘルパー
// =========================================================================

/**
 * シートを取得、存在しなければヘッダー付きで新規作成
 */
function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

/**
 * 判定ログシートへ1行追記する
 * 申込に至らなかったケースも含め市場ニーズを可視化するために使用
 *
 * 参照用シート（判定ログ）: 直近30件のみ保持。ヘッダー直下に挿入し、31件目以降を削除
 * 蓄積用シート（判定ログ_履歴）: 全件を末尾に追加。削除しない
 */
function recordAssessmentLog(ss, data) {
  var HEADERS = [
    "記録日時",
    "施設名",
    "判定結果",
    "疾患名",
    "ADLレベル",
    "認知症レベル",
    "生活保護",
    "予算",
    "判定補足",
    "リピーター",
    "記録元",
  ];

  var rowData = [
    new Date(),
    data.facilityName || "",
    data.result || "",
    data.disease || "",
    data.adl || "",
    data.dementiaLevel || "",
    data.welfare || "",
    data.budget || "",
    data.reason || "",
    data.isRepeater || "",
    data.source || "direct",
  ];

  // --- 参照用シート（直近30件） ---
  var sheet = getOrCreateSheet(ss, "判定ログ", HEADERS);
  // ヘッダー直下（2行目）に挿入
  sheet.insertRowAfter(1);
  sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
  // 31件を超える行を削除（ヘッダー + 30データ行 = 31行まで）
  var lastRow = sheet.getLastRow();
  if (lastRow > 31) {
    sheet.deleteRows(32, lastRow - 31);
  }

  // --- 蓄積用シート（全件保持） ---
  var historySheet = getOrCreateSheet(ss, "判定ログ_履歴", HEADERS);
  historySheet.appendRow(rowData);
}

/**
 * メール本文を整形する
 */
// =========================================================================
// 通知設定シート — 内部読み取り（スプレッドシートオブジェクト渡し）
// =========================================================================
function getNotificationEmailsFromSheet_internal(ss) {
  var sheet = ss.getSheetByName("通知設定");
  if (!sheet) {
    sheet = ss.insertSheet("通知設定");
    sheet.appendRow(["email"]);
    return [];
  }
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var emails = [];
  for (var i = 0; i < values.length; i++) {
    var addr = String(values[i][0] || "").trim();
    if (addr) emails.push(addr);
  }
  return emails;
}

// =========================================================================
// 通知設定シート — doGet用読み取り（JSON応答）
// =========================================================================
function readNotificationEmailsFromSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var emails = getNotificationEmailsFromSheet_internal(ss);
  return ContentService.createTextOutput(
    JSON.stringify({ emails: emails })
  ).setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// 通知設定シート — doPost用書き込み
// =========================================================================
function writeNotificationEmailsToSheet(ss, emails) {
  var HEADERS = ["email"];
  var sheet = getOrCreateSheet(ss, "通知設定", HEADERS);

  // 既存データ行をクリア（ヘッダーは保持）
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 1).clearContent();
  }

  // メールアドレスを書き込み
  if (emails.length === 0) return;
  var rows = [];
  for (var i = 0; i < emails.length; i++) {
    var addr = String(emails[i] || "").trim();
    if (addr) rows.push([addr]);
  }
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 1).setValues(rows);
  }
}

function buildEmailBody(body, dates, assessment) {
  var lines = [];

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("  ええすまいポータルより面談受付が入りました");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");

  lines.push("■ 予約者情報");
  lines.push("  氏名　　：" + (body.contactName || ""));
  lines.push("  電話番号：" + (body.phone || ""));
  lines.push("  メール　：" + (body.email || "未入力"));
  lines.push("");

  lines.push("■ 希望施設");
  lines.push("  " + (body.facilityName || ""));
  lines.push("");

  lines.push("■ 面談希望日程");
  for (var i = 0; i < Math.min(dates.length, 3); i++) {
    var slot = dates[i];
    var label = "  第" + (i + 1) + "希望：";
    lines.push(label + slot.date + "  " + (slot.timeSlot || "指定なし"));
  }
  if (dates.length === 0) {
    lines.push("  （日程指定なし）");
  }
  lines.push("");

  lines.push("■ 確度判定");
  if (assessment && assessment.status) {
    lines.push("  判定結果：" + assessment.status);
    if (assessment.disease) lines.push("  疾患　　：" + assessment.disease);
    if (assessment.adl) lines.push("  ADL　　 ：" + assessment.adl);
    if (assessment.reason) lines.push("  補足　　：" + assessment.reason);

    // 安全リスク判定時の特別警告
    if (assessment.status === "要慎重検討（安全リスク）") {
      lines.push("");
      lines.push("  ⚠️ 【安全リスク警告】");
      lines.push("  ADLが高く重度の徘徊症状があるケースです。");
      lines.push("  幹線道路近接による交通事故リスクがあり、");
      lines.push("  事前面談での慎重なリスク協議が必要です。");
    }
  } else {
    lines.push("  （判定情報なし ― ダイレクト受付）");
  }
  lines.push("");

  if (body.notes) {
    lines.push("■ 備考");
    lines.push("  " + body.notes);
    lines.push("");
  }

  if (body.isRepeater) {
    lines.push("※ この方はリピーター（過去に申込履歴あり）です。");
    lines.push("");
  }

  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push(body.urgencyMessage || "至急、上記連絡先へ日程確定の連絡をお願いします。");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return lines.join("\n");
}
