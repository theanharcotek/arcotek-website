/* =============================================================
   i18n.js — Vietnamese / English toggle
   Usage: <span data-i18n="key"></span>  | inputs: data-i18n-ph="key"
   Default language: VI. Choice persists in localStorage.
   ============================================================= */
(function () {
  "use strict";

  const DICT = {
    vi: {
      "brand.sub": "Xây dựng & Phòng cháy chữa cháy",
      // Nav
      "nav.home": "Trang chủ",
      "nav.services": "Dịch vụ",
      "nav.projects": "Dự án",
      "nav.about": "Về chúng tôi",
      "nav.news": "Tin tức",
      "nav.contact": "Liên hệ",
      "cta.consult": "Tư vấn miễn phí",
      "cta.quote": "Nhận báo giá",
      "cta.viewall": "Xem tất cả",
      "cta.detail": "Chi tiết",
      "cta.readmore": "Đọc tiếp",

      // Home — hero
      "home.hero.eyebrow": "An toàn cháy nổ · Đồng Nai",
      "home.hero.l1": "Bảo vệ con người",
      "home.hero.l2": "& tài sản bằng",
      "home.hero.l3": "giải pháp PCCC chuẩn mực",
      "home.hero.lead": "Đơn vị tư vấn, thiết kế và thi công hệ thống phòng cháy chữa cháy đạt chuẩn TCVN — đồng hành cùng nhà máy, kho xưởng và công trình dân dụng tại Đồng Nai và toàn miền Nam.",
      "home.stat1.label": "Công trình hoàn thành",
      "home.stat2.label": "Năm kinh nghiệm",
      "home.stat3.label": "Nghiệm thu đạt chuẩn",
      "home.stat4.label": "Hỗ trợ khẩn cấp",

      // Home — services
      "home.serv.eyebrow": "Dịch vụ cốt lõi",
      "home.serv.title": "Giải pháp PCCC trọn gói",
      "home.serv.lead": "Từ khảo sát, thiết kế bản vẽ, xin thẩm duyệt đến thi công và bảo trì — một đầu mối duy nhất chịu trách nhiệm toàn bộ.",
      "home.serv1.t": "Tư vấn & Thẩm duyệt",
      "home.serv1.d": "Lập hồ sơ thiết kế, xin thẩm duyệt và nghiệm thu PCCC với cơ quan Cảnh sát PCCC theo đúng quy định pháp luật.",
      "home.serv2.t": "Thiết kế hệ thống",
      "home.serv2.d": "Thiết kế hệ thống báo cháy, chữa cháy tự động Sprinkler, họng nước vách tường, khí sạch... tối ưu chi phí và an toàn.",
      "home.serv3.t": "Thi công lắp đặt",
      "home.serv3.d": "Đội ngũ kỹ thuật thi công đúng bản vẽ, vật tư chính hãng, tiến độ cam kết và bàn giao hồ sơ hoàn công đầy đủ.",
      "home.serv4.t": "Bảo trì & Kiểm định",
      "home.serv4.d": "Bảo trì định kỳ, kiểm tra, nạp sạc bình chữa cháy và kiểm định thiết bị giúp hệ thống luôn sẵn sàng.",

      // Home — why / split
      "home.why.eyebrow": "Vì sao chọn chúng tôi",
      "home.why.title": "Chuẩn mực kỹ thuật, tận tâm trách nhiệm",
      "home.why.lead": "Chúng tôi không chỉ lắp đặt thiết bị — chúng tôi xây dựng sự an tâm dựa trên năng lực kỹ thuật và hồ sơ pháp lý minh bạch.",
      "home.why1.t": "Đội ngũ chứng chỉ hành nghề",
      "home.why1.d": "Kỹ sư PCCC được đào tạo bài bản, có chứng chỉ và kinh nghiệm thực chiến tại các khu công nghiệp lớn.",
      "home.why2.t": "Vật tư chính hãng, có CO/CQ",
      "home.why2.d": "Thiết bị từ các thương hiệu uy tín, đầy đủ chứng nhận xuất xứ và chất lượng, kiểm định rõ ràng.",
      "home.why3.t": "Cam kết tiến độ & bảo hành",
      "home.why3.d": "Hợp đồng minh bạch, đúng tiến độ, bảo hành dài hạn và hỗ trợ kỹ thuật khẩn cấp 24/7.",
      "home.why.badge.t": "Đạt chuẩn TCVN & QCVN",
      "home.why.badge.d": "Nghiệm thu PCCC đúng quy định",

      // Home — process
      "home.proc.eyebrow": "Quy trình làm việc",
      "home.proc.title": "5 bước minh bạch từ A đến Z",
      "home.proc1.t": "Khảo sát hiện trạng",
      "home.proc1.d": "Đánh giá công trình, xác định cấp nguy hiểm cháy và nhu cầu thực tế.",
      "home.proc2.t": "Thiết kế & Báo giá",
      "home.proc2.d": "Lập bản vẽ kỹ thuật và báo giá chi tiết, minh bạch từng hạng mục.",
      "home.proc3.t": "Thẩm duyệt hồ sơ",
      "home.proc3.d": "Hoàn thiện và trình hồ sơ thẩm duyệt với cơ quan chức năng.",
      "home.proc4.t": "Thi công lắp đặt",
      "home.proc4.d": "Triển khai đúng bản vẽ, giám sát chặt chẽ và kiểm tra chất lượng.",
      "home.proc5.t": "Nghiệm thu & Bàn giao",
      "home.proc5.d": "Nghiệm thu cùng cơ quan PCCC và bàn giao hồ sơ hoàn công.",

      // Home — projects
      "home.proj.eyebrow": "Dự án tiêu biểu",
      "home.proj.title": "Những công trình chúng tôi đã bảo vệ",
      "home.proj1.tag": "Nhà máy",
      "home.proj1.t": "Hệ thống Sprinkler nhà xưởng 12.000m²",
      "home.proj2.tag": "Tòa nhà",
      "home.proj2.t": "Báo cháy địa chỉ cao ốc văn phòng",
      "home.proj3.tag": "Kho logistics",
      "home.proj3.t": "Chữa cháy kho hàng cao tầng",

      // Home — band
      "home.band.title": "Sẵn sàng bảo vệ công trình của bạn?",
      "home.band.lead": "Nhận tư vấn và khảo sát miễn phí trong 24 giờ.",

      // Home — testimonials
      "home.tes.eyebrow": "Khách hàng nói gì",
      "home.tes.title": "Niềm tin từ các đối tác",
      "home.tes1.q": "Đội ngũ làm việc chuyên nghiệp, hồ sơ thẩm duyệt thông qua ngay lần đầu. Tiến độ thi công đúng cam kết.",
      "home.tes1.n": "Ban Quản lý KCN Amata",
      "home.tes1.r": "Khách hàng doanh nghiệp",
      "home.tes2.q": "Tư vấn tận tâm, báo giá rõ ràng minh bạch. Hệ thống vận hành ổn định sau hơn 2 năm sử dụng.",
      "home.tes2.n": "Công ty TNHH Sản xuất Phú Thành",
      "home.tes2.r": "Nhà máy sản xuất",

      // Final CTA
      "cta.final.title": "An toàn hôm nay, an tâm dài lâu",
      "cta.final.lead": "Liên hệ ngay để được kỹ sư PCCC tư vấn giải pháp phù hợp với công trình của bạn.",

      // Services page
      "serv.hero.eyebrow": "Dịch vụ",
      "serv.hero.title": "Giải pháp PCCC toàn diện",
      "serv.hero.lead": "Một đối tác duy nhất cho toàn bộ vòng đời hệ thống phòng cháy chữa cháy của bạn.",

      // Projects page
      "proj.hero.eyebrow": "Dự án & Công trình",
      "proj.hero.title": "Hồ sơ năng lực thực chiến",
      "proj.hero.lead": "Tuyển tập các công trình tiêu biểu đã được thiết kế, thi công và nghiệm thu đạt chuẩn.",

      // About page
      "about.hero.eyebrow": "Về chúng tôi",
      "about.hero.title": "Tận tâm với từng giải pháp an toàn",
      "about.hero.lead": "Hơn một thập kỷ đồng hành cùng sự an toàn của các doanh nghiệp và gia đình tại Đồng Nai.",
      "about.story.t": "Câu chuyện của chúng tôi",
      "about.story.p1": "Được thành lập bởi đội ngũ kỹ sư tâm huyết, chúng tôi mang sứ mệnh nâng cao tiêu chuẩn an toàn cháy nổ cho các công trình tại Đồng Nai và khu vực phía Nam.",
      "about.story.p2": "Từ những dự án nhà xưởng đầu tiên, chúng tôi đã không ngừng hoàn thiện năng lực kỹ thuật, cập nhật công nghệ và quy chuẩn mới nhất để mang lại giải pháp tối ưu cho khách hàng.",
      "about.mission.t": "Sứ mệnh",
      "about.mission.d": "Bảo vệ sinh mạng và tài sản bằng giải pháp PCCC đạt chuẩn, đáng tin cậy.",
      "about.vision.t": "Tầm nhìn",
      "about.vision.d": "Trở thành đơn vị PCCC hàng đầu khu vực Đông Nam Bộ.",
      "about.value.t": "Giá trị cốt lõi",
      "about.value.d": "Trách nhiệm — Minh bạch — Chuẩn mực kỹ thuật.",

      // News page
      "news.hero.eyebrow": "Tin tức & Kiến thức",
      "news.hero.title": "Cập nhật về an toàn PCCC",
      "news.hero.lead": "Quy định mới, hướng dẫn kỹ thuật và kinh nghiệm thực tế về phòng cháy chữa cháy.",

      // Contact page
      "contact.hero.eyebrow": "Liên hệ",
      "contact.hero.title": "Bắt đầu cuộc trò chuyện",
      "contact.hero.lead": "Để lại thông tin, kỹ sư của chúng tôi sẽ liên hệ tư vấn và khảo sát miễn phí.",
      "contact.info.addr": "Địa chỉ",
      "contact.info.phone": "Hotline 24/7",
      "contact.info.email": "Email",
      "contact.info.hours": "Giờ làm việc",
      "contact.info.hours.v": "Thứ 2 – Thứ 7: 8:00 – 17:30",
      "contact.form.name": "Họ và tên",
      "contact.form.phone": "Số điện thoại",
      "contact.form.email": "Email",
      "contact.form.service": "Dịch vụ quan tâm",
      "contact.form.msg": "Mô tả nhu cầu",
      "contact.form.msg.ph": "Mô tả ngắn về công trình và nhu cầu của bạn...",
      "contact.form.submit": "Gửi yêu cầu tư vấn",
      "contact.form.note": "Cảm ơn bạn! Yêu cầu đã được ghi nhận, chúng tôi sẽ liên hệ trong thời gian sớm nhất.",

      // Footer
      "foot.tagline": "Đối tác tin cậy về phòng cháy chữa cháy tại Đồng Nai — tư vấn, thiết kế, thi công và bảo trì trọn gói.",
      "foot.services": "Dịch vụ",
      "foot.company": "Công ty",
      "foot.contact": "Liên hệ",
      "foot.rights": "Bản quyền thuộc về công ty. Đã đăng ký.",
    },

    en: {
      "brand.sub": "Construction & Fire Protection",
      "nav.home": "Home",
      "nav.services": "Services",
      "nav.projects": "Projects",
      "nav.about": "About",
      "nav.news": "News",
      "nav.contact": "Contact",
      "cta.consult": "Free Consultation",
      "cta.quote": "Get a Quote",
      "cta.viewall": "View all",
      "cta.detail": "Details",
      "cta.readmore": "Read more",

      "home.hero.eyebrow": "Fire Safety · Dong Nai",
      "home.hero.l1": "Protecting people",
      "home.hero.l2": "& assets with",
      "home.hero.l3": "standard-compliant fire systems",
      "home.hero.lead": "We consult, design and install fire protection systems compliant with Vietnamese standards (TCVN) — serving factories, warehouses and buildings across Dong Nai and Southern Vietnam.",
      "home.stat1.label": "Completed projects",
      "home.stat2.label": "Years of experience",
      "home.stat3.label": "Inspection pass rate",
      "home.stat4.label": "Emergency support",

      "home.serv.eyebrow": "Core services",
      "home.serv.title": "End-to-end fire protection",
      "home.serv.lead": "From survey, design and approval to installation and maintenance — one single point of accountability.",
      "home.serv1.t": "Consulting & Approval",
      "home.serv1.d": "Design documentation, approval and acceptance with the Fire Police authority in full compliance with the law.",
      "home.serv2.t": "System Design",
      "home.serv2.d": "Design of fire alarm, automatic sprinkler, wall hydrants and clean-agent systems — optimized for cost and safety.",
      "home.serv3.t": "Installation",
      "home.serv3.d": "Technical teams install per drawings with genuine materials, committed schedules and complete as-built records.",
      "home.serv4.t": "Maintenance & Inspection",
      "home.serv4.d": "Periodic maintenance, testing, extinguisher recharging and equipment inspection keep the system always ready.",

      "home.why.eyebrow": "Why choose us",
      "home.why.title": "Technical excellence, true accountability",
      "home.why.lead": "We don't just install equipment — we build peace of mind through engineering capability and transparent legal documentation.",
      "home.why1.t": "Licensed professional team",
      "home.why1.d": "Formally trained, certified fire-protection engineers with hands-on experience in major industrial parks.",
      "home.why2.t": "Genuine materials with CO/CQ",
      "home.why2.d": "Equipment from reputable brands, with full certificates of origin and quality, clearly verified.",
      "home.why3.t": "Schedule & warranty commitment",
      "home.why3.d": "Transparent contracts, on-time delivery, long-term warranty and 24/7 emergency technical support.",
      "home.why.badge.t": "TCVN & QCVN compliant",
      "home.why.badge.d": "Inspection per regulations",

      "home.proc.eyebrow": "How we work",
      "home.proc.title": "5 transparent steps, A to Z",
      "home.proc1.t": "Site survey",
      "home.proc1.d": "Assess the project, define fire hazard class and real requirements.",
      "home.proc2.t": "Design & Quote",
      "home.proc2.d": "Prepare technical drawings and a detailed, transparent quotation.",
      "home.proc3.t": "Approval",
      "home.proc3.d": "Complete and submit the design dossier to the authorities.",
      "home.proc4.t": "Installation",
      "home.proc4.d": "Execute per drawings with close supervision and quality control.",
      "home.proc5.t": "Acceptance & Handover",
      "home.proc5.d": "Acceptance with the Fire authority and as-built handover.",

      "home.proj.eyebrow": "Featured projects",
      "home.proj.title": "Facilities we've protected",
      "home.proj1.tag": "Factory",
      "home.proj1.t": "12,000m² workshop sprinkler system",
      "home.proj2.tag": "Building",
      "home.proj2.t": "Addressable alarm for office tower",
      "home.proj3.tag": "Logistics",
      "home.proj3.t": "High-bay warehouse fire suppression",

      "home.band.title": "Ready to protect your facility?",
      "home.band.lead": "Get a free consultation and survey within 24 hours.",

      "home.tes.eyebrow": "Testimonials",
      "home.tes.title": "Trusted by our partners",
      "home.tes1.q": "A professional team — our approval dossier passed on the first submission, and installation met the committed schedule.",
      "home.tes1.n": "Amata IP Management Board",
      "home.tes1.r": "Corporate client",
      "home.tes2.q": "Dedicated advice and transparent quotes. The system has run reliably for over two years.",
      "home.tes2.n": "Phu Thanh Manufacturing Co., Ltd",
      "home.tes2.r": "Manufacturing plant",

      "cta.final.title": "Safe today, secure for years",
      "cta.final.lead": "Contact us now and our fire-protection engineers will advise the right solution for your project.",

      "serv.hero.eyebrow": "Services",
      "serv.hero.title": "Comprehensive fire protection",
      "serv.hero.lead": "A single partner for the entire lifecycle of your fire protection system.",

      "proj.hero.eyebrow": "Projects",
      "proj.hero.title": "A proven track record",
      "proj.hero.lead": "A selection of featured projects designed, installed and accepted to standard.",

      "about.hero.eyebrow": "About us",
      "about.hero.title": "Dedicated to every safety solution",
      "about.hero.lead": "Over a decade safeguarding businesses and families across Dong Nai.",
      "about.story.t": "Our story",
      "about.story.p1": "Founded by a team of dedicated engineers, our mission is to raise fire-safety standards for projects in Dong Nai and Southern Vietnam.",
      "about.story.p2": "From our first workshop projects, we have continuously refined our engineering capability and adopted the latest technologies and standards to deliver optimal solutions.",
      "about.mission.t": "Mission",
      "about.mission.d": "Protect lives and property with reliable, standard-compliant fire protection.",
      "about.vision.t": "Vision",
      "about.vision.d": "Become the leading fire-protection firm in the Southeast region.",
      "about.value.t": "Core values",
      "about.value.d": "Accountability — Transparency — Technical excellence.",

      "news.hero.eyebrow": "News & Knowledge",
      "news.hero.title": "Fire-safety updates",
      "news.hero.lead": "New regulations, technical guidance and practical fire-protection experience.",

      "contact.hero.eyebrow": "Contact",
      "contact.hero.title": "Start the conversation",
      "contact.hero.lead": "Leave your details and our engineers will reach out for a free consultation and survey.",
      "contact.info.addr": "Address",
      "contact.info.phone": "24/7 Hotline",
      "contact.info.email": "Email",
      "contact.info.hours": "Working hours",
      "contact.info.hours.v": "Mon – Sat: 8:00 – 17:30",
      "contact.form.name": "Full name",
      "contact.form.phone": "Phone number",
      "contact.form.email": "Email",
      "contact.form.service": "Service of interest",
      "contact.form.msg": "Your needs",
      "contact.form.msg.ph": "Briefly describe your project and requirements...",
      "contact.form.submit": "Send request",
      "contact.form.note": "Thank you! Your request has been received and we will contact you shortly.",

      "foot.tagline": "Your trusted fire-protection partner in Dong Nai — consulting, design, installation and maintenance, all in one.",
      "foot.services": "Services",
      "foot.company": "Company",
      "foot.contact": "Contact",
      "foot.rights": "All rights reserved.",
    },
  };

  const STORE_KEY = "pccc-lang";
  let lang = localStorage.getItem(STORE_KEY) || "vi";

  function apply(l) {
    lang = DICT[l] ? l : "vi";
    const d = DICT[lang];
    document.documentElement.setAttribute("lang", lang);

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (d[key] != null) el.textContent = d[key];
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      const key = el.getAttribute("data-i18n-ph");
      if (d[key] != null) el.setAttribute("placeholder", d[key]);
    });

    document.querySelectorAll("[data-lang-btn]").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-lang-btn") === lang);
    });
    localStorage.setItem(STORE_KEY, lang);
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang-btn]");
    if (btn) apply(btn.getAttribute("data-lang-btn"));
  });

  apply(lang);
  window.PCCC_setLang = apply;
})();
