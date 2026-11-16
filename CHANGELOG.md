# Rix Hold'em Pro (Championship Edition) — Changelog & Architecture Report

## 1. Deep Audit & Bugs Fixed
- **Giải quyết Side Pots nhiều cửa (All-in Resolution)**: Xử lý chuẩn xác tình huống nhiều người chơi All-in với số chip khác nhau, tạo các hũ phụ (Side Pots) và phân chia tiền cược minh bạch theo thứ tự điểm bài.
- **Đồng bộ thời gian thực Win Equity**: Tối ưu hóa thuật toán tính xác suất bài tẩy kết hợp bài chung (Community Cards) mà không làm nghẽn tiến trình render giao diện.
- **Dọn dẹp file thừa**: Đã loại bỏ file backup cũ không còn sử dụng (`index.old.html`) để thư mục dự án luôn tinh gọn.

---

## 2. Kiến trúc Tái Cấu Trúc (Architecture Refactoring)
Phân tách cấu trúc nguyên khối thành các module độc lập:
```
pokerhe/
├── css/
│   └── style.css            # Toàn bộ theme nỉ bàn VIP, bố cục bàn tròn, chip, thẻ bài & modal
├── js/
│   ├── audio-engine.js      # Bộ tổng hợp âm thanh Web Audio API (thao tác cược, fold, win, chip)
│   ├── poker-evaluator.js   # Thuật toán thẩm định bài 5 & 7 lá, tính Win Equity % & Outs Radar
│   ├── bot-brain.js         # Trí tuệ nhân tạo bot poker (phân tích Pot Odds, rủi ro, bluffing)
│   └── game-engine.js       # Máy trạng thái bàn đấu, quản lý vòng cược, radial timer & UI
├── index.html               # File HTML5 ngữ nghĩa, gọn gàng và tương thích cao
├── index beta.html          # Bản đồng bộ Championship Edition
└── CHANGELOG.md             # Tài liệu kiểm toán và hướng dẫn sử dụng
```

---

## 3. Cải tiến UI/UX & Hiệu năng
- **Vòng tròn đếm ngược lượt chơi (Radial Timer Ring)**: Hiển thị thời gian suy nghĩ trực quan bằng SVG SVG Dasharray chuyển màu từ xanh sang cam và đỏ khi sắp hết giờ.
- **Bàn cược tùy biến (VIP Felt Themes)**: 4 màu nỉ bàn sang trọng: Classic Emerald, Royal Blue, Velvet Crimson, Midnight Onyx.

---

## 4. Tính năng mới bổ sung
1. **🎯 Radar Cửa Đợi (Outs & Draw Radar)**:
   - Hiển thị trực tiếp cảnh báo bài đợi: *Đợi Thùng (9 outs)*, *Đợi Sảnh 2 đầu (8 outs)*, *Đợi Sảnh lọt khe (4 outs)*.
2. **📊 Win Equity % Thời Gian Thực**:
   - Đo tỷ lệ thắng tức thì so với range bài của đối thủ.
3. **💰 Tự động cấp vốn cứu trợ**: Tự động tài trợ 1.000 chip nếu người chơi hoặc bot bị cạn tiền.