# reference/：放置規劃資料包（不進 Git）

本專案的規格與來源來自使用者提供的交接包
`電子學儀器模擬_Opus交接包_20260929.zip`（SHA-256 `c447853c04780d274e3fddab16bbcb7ffcc962b3bf5427cd70a062c2ddfa3a83`，13,836,450 bytes）。

這個 repo 是 **public**。包內的原廠 PDF 屬各廠商著作，校機照片是使用者私人拍攝，
所以不把它們提交到 Git；文件裡只用「來源 ID＋檔名＋SHA-256＋頁碼」引用。

本機或雲端重建方式：

```sh
unzip 電子學儀器模擬_Opus交接包_20260929.zip -d reference/
python3 reference/electronics-lab-handoff-20260929/verify_bundle.py
# 預期：OK: 21 files match size and SHA-256. This is NOT an application test.
```

`reference/` 內除本檔外都被 `.gitignore` 排除。
