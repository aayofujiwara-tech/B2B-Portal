/**
 * ええすまいポータル 面談受付通知 — Google Apps Script
 *
 * 【使い方】
 * 1. Google スプレッドシートを新規作成し、シート名を「受付ログ」にする
 * 2. 「拡張機能 > Apps Script」を開き、このコードを貼り付ける
 * 3. 「デプロイ > 新しいデプロイ」→ 種類「ウェブアプリ」→ アクセス「全員」で公開
 * 4. 生成されたURLを .env.local の GAS_WEBHOOK_URL に設定する
 *
 * 【シート構成】
 * - 「受付ログ」: 面談予約の受付記録
 * - 「判定ログ」: 全ての判定結果を記録（申込に至らなかったケースも含む）
 */

function doPost(e) {
  try {
    var json = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

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
    var sheet = getOrCreateSheet(ss, "受付ログ", [
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
    ]);

    var dates = body.preferredDates || [];
    var d1 = dates[0] ? dates[0].date + " " + (dates[0].timeSlot || "指定なし") : "";
    var d2 = dates[1] ? dates[1].date + " " + (dates[1].timeSlot || "指定なし") : "";
    var d3 = dates[2] ? dates[2].date + " " + (dates[2].timeSlot || "指定なし") : "";

    var assessment = body.assessmentResult || {};

    sheet.appendRow([
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
    ]);

    // 2. 判定ログシートへも記録（受付に紐づく判定データ）
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
        source: "booking",
      });
    }

    // 3. メール送信
    var recipients = json.to || [];
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
 */
function recordAssessmentLog(ss, data) {
  var sheet = getOrCreateSheet(ss, "判定ログ", [
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
  ]);

  sheet.appendRow([
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
  ]);
}

/**
 * メール本文を整形する
 */
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
