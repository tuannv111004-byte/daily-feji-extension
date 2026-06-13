# Daily Feji Batch Helper

Chrome extension ho tro tao Daily post, tao Feji short link, va xuat ket qua.

## Cai extension

1. Mo Chrome va vao `chrome://extensions`.
2. Bat `Developer mode`.
3. Chon `Load unpacked`.
4. Chon thu muc `C:\Tool\tools\FB-Scheduler\Extension`.

## Dung extension

1. Dang nhap san vao Daily va Feji trong cung trinh duyet.
2. Mo popup extension.
3. Nhap tung bai hoac import JSON.
4. Chon cach chen anh vao description.
5. Neu muon day ket qua vao FB Scheduler, bat `Tu dong gui ket qua done sang FB Scheduler`.
6. Dien:
   - Scheduler URL: URL app FB Scheduler, vi du `https://your-app.vercel.app`
   - Import token: trung voi `EXTENSION_IMPORT_TOKEN` trong app
   - Page ID: Supabase `pages.id` cua page can tao post
   - Start date va Start time slot
   - Post status
7. Bam `Start batch`.

JSON ho tro:

```json
[
  {
    "title": "Title 1",
    "description": "<p>Noi dung...</p>",
    "image": "https://example.com/cover.webp",
    "descriptionImage": "https://example.com/inside.webp"
  }
]
```

## FB Scheduler API

App FB Scheduler can co env:

```env
EXTENSION_IMPORT_TOKEN=your-secret-token
```

Extension se goi:

```text
POST /api/extension/daily-results
```

Mapping khi gui sang FB Scheduler:

- `title` -> tieu de Daily/Feji va notes
- post caption -> giu nguyen tren post co san
- post image -> giu nguyen tren post co san
- `shortLink` -> thay the adsLink cua post co san
- `dailyLink` va `domain` -> notes

Neu item co `schedulerPostId` tu Composer, extension se gui item do ve Scheduler ngay sau khi
tao xong Daily + Feji link. Loi cua mot item se duoc ghi rieng tren item do va khong chan cac
item tiep theo.

API se tim cac post cua page tu `Start date` + `Start time slot` tro di. Neu slot bat dau
khong co post thi lay post gan nhat tiep theo. Neu post da co adsLink thi van thay the bang
shortLink moi. Extension khong tao post moi.
