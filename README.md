# FDR DRAMAS DL - Hongguo Short Drama Downloader (Luxury Premium)

កម្មវិធី Desktop App កម្រិត **Luxury Premium (Dark Gold)** សម្រាប់ស្វែងរក មើលសាកល្បង (Preview) និងទាញយក (Download) រឿងភាគខ្លីពី **Hongguo (红果短剧)**, Douyin និងបណ្តាញ MacCMS / AppleCMS V10 JSON APIs ដោយស្វ័យប្រវត្តិ។

---

## 🌟 លក្ខណៈពិសេសចម្បង (Key Features)

1. **Luxury Premium Dark Gold Interface**:
   - រចនាបថពណ៌មាសប្រណិត (Champagne Metallic Gold) និងផ្ទៃខាងក្រោយ Onyx Black Glassmorphism
   - បែបផែនពន្លឺ Gold Ambient Glow, Smooth 60fps Micro-animations
   - គាំទ្រពហុភាសា៖ **ភាសាខ្មែរ (Khmer)**, **English**, និង **中文 (Chinese)**
   - ផ្ទាំងបញ្ជា Windows ទំនើប (Custom Frameless Titlebar)

2. **Hongguo & Multi-Source Drama Explorer (រុករកទូទៅ)**:
   - ភ្ជាប់ដោយផ្ទាល់ជាមួយ MacCMS / AppleCMS V10 JSON API ដែលមានរឿងភាគខ្លីជាង **30,000+ រឿង**
   - តម្រៀបតាមប្រភេទពេញនិយម៖ 战神 (ស្ដេចសឹក), 逆袭 (វាយបក), 甜宠 (ស្នេហាផ្អែមល្ហែម), 穿越 (ឆ្លងភព), 赘婿 (កូនប្រសារ), 悬疑 (អាថ៌កំបាំង), AI 漫剧 (គំនូរជីវចល)
   - ស្វែងរកតាមឈ្មោះរឿងយ៉ាងរហ័ស

3. **Hongguo Web Link Sniffer (ទាញយកតាម Link)**:
   - គ្រាន់តែបិទភ្ជាប់ (Paste) តំណភ្ជាប់ពីគេហទំព័រ Hongguo, Douyin ឬ Link `.m3u8` / `.mp4`
   - ប្រព័ន្ធ Sniffer Background Engine នឹងចាប់យក Stream វីដេអូកម្រិតច្បាស់ (1080P) ដោយស្វ័យប្រវត្តិ
   - ប៊ូតុង Preview ទស្សនាមុនពេលទាញយក

4. **Batch Episode Downloader (ទាញយកជាភាគ ឬទាំងអស់)**:
   - ជ្រើសរើសភាគមួយៗ ឬ "ជ្រើសរើសទាំងអស់ (Select All)" ក្នុងមួយចុច
   - ប្រើប្រាស់ FFmpeg Stream Copy Engine ដោយមិនបាត់បង់គុណភាព (Lossless 1080P) និងមានល្បឿនលឿនខ្លាំង (Super Fast Multi-threaded)
   - តាមដានល្បឿនទាញយកផ្ទាល់ (MB/s), ភាគរយ (%) និងទំហំឯកសារ
   - មុខងារ ផ្អាក (Pause), បន្ត (Resume), បោះបង់ (Cancel), និងបើកថតផ្ទុកឯកសារ (Open Folder) ភ្លាមៗ

5. **JSON Sources & Settings Management (គ្រប់គ្រងប្រភព JSON)**:
   - អាចបន្ថែម កែសម្រួល ឬបិទ/បើកប្រភព JSON API តាមឯកសារ `data/sources.json`
   - មានប៊ូតុង Test Ping ដើម្បីពិនិត្យមើលល្បឿន Latency (ms) នៃ Server នីមួយៗ
   - ជ្រើសរើសថតទាញយក (Download Folder) ដោយសេរី

6. **Built-in Luxury Video Player**:
   - កម្មវិធីចាក់វីដេអូក្នុងកម្មវិធីផ្ទាល់ គាំទ្រទាំង M3U8 HLS streaming និងឯកសារ MP4

---

## 🚀 របៀបដំណើរការកម្មវិធី (How to Run)

នៅក្នុងថតគម្រោង `d:\Software tool\FDR DRAMAS DL`៖

```bash
# ដំណើរការកម្មវិធី (Run Desktop App)
npm start
```

---

## 📁 រចនាសម្ព័ន្ធគម្រោង (Project Architecture)

```
FDR DRAMAS DL/
├── data/
│   ├── sources.json       # ប្រភព JSON APIs (Hongguo, AppleCMS V10)
│   ├── settings.json      # ការកំណត់ (ថតទាញយក, ភាសា, Concurrency)
│   ├── downloads.json     # ប្រវត្តិ និង Task ទាញយក
│   └── history.json       # ប្រវត្តិស្វែងរក
├── src/
│   ├── downloader.js      # FFmpeg & Node.js Stream Download Engine
│   ├── sniffer.js         # Web Link Sniffer សម្រាប់គេហទំព័រ Hongguo
│   └── api.js             # មុខងារ Fetch & Parse ទិន្នន័យ MacCMS V10
├── renderer/
│   ├── index.html         # ទម្រង់ UI Luxury Premium
│   ├── styles.css         # CSS Dark Gold Glassmorphism
│   ├── i18n.js            # វចនានុក្រមភាសាខ្មែរ / English / 中文
│   ├── app.js             # Logic អន្តរកម្មទាំងអស់
│   └── hls.min.js         # កម្មវិធីចាក់ HLS Stream ក្នុងម៉ាស៊ីន
├── downloads/             # ថតផ្ទុកវីដេអូដែលបានទាញយក
├── main.js                # Electron Main Process
├── preload.js             # Electron Preload Safe IPC
└── package.json           # ការកំណត់ Node/Electron
```
