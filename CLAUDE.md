## 法務・プライバシーポリシー実装
- 確定済みの利用規約は `docs/legal/eesumai_policy.md` にある。これが正式な原本。内容を勝手に変更しないこと。
- 実装の全タスク・仕様は `docs/legal/eesumai_implementation_guide.md` に記載済み。実装時は必ずこのファイルを読んでから着手すること。
- 規約コンテンツは Markdown ファイルのまま管理し、react-markdown 等でレンダリングする。TSX への直接埋め込みは禁止。
- 同意チェックボックスは共通コンポーネント（ConsentCheckbox）として作り、入居判定フォームと面談予約フォームで共有する。
- フォーム送信時に `agreed_terms`, `agreed_consent`, `agreed_at`（ISO 8601）を必ず記録する。
