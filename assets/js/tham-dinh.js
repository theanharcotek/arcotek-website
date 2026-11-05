/* Xem văn bản thẩm định PCCC trên trang Dự án */
(function () {
  "use strict";
  var lb = document.getElementById("tdLb");
  if (!lb) return;
  var img = document.getElementById("tdImg"), title = document.getElementById("tdLbTitle");
  var count = document.getElementById("tdCount"), prev = document.getElementById("tdPrev");
  var next = document.getElementById("tdNext"), closeBtn = document.getElementById("tdClose");
  var stage = lb.querySelector(".td-lb-stage");
  var doc = null, pages = 1, page = 1, opener = null;

  function show() {
    img.src = "assets/img/tham-dinh/tham-dinh-" + doc + "-" + page + ".jpg";
    img.alt = title.textContent + " – trang " + page + " (đã che thông tin)";
    count.textContent = page + " / " + pages;
    prev.disabled = page <= 1;
    next.disabled = page >= pages;
    stage.scrollTop = 0;
  }
  function open(card) {
    opener = card;
    doc = card.getAttribute("data-td");
    pages = parseInt(card.getAttribute("data-pages"), 10) || 1;
    page = 1;
    title.textContent = card.getAttribute("data-title");
    show();
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }
  function close() {
    lb.hidden = true;
    document.body.style.overflow = "";
    if (opener) opener.focus();
  }
  document.querySelectorAll(".td-card").forEach(function (card) {
    card.addEventListener("click", function (e) { e.preventDefault(); open(card); });
  });
  prev.addEventListener("click", function () { if (page > 1) { page--; show(); } });
  next.addEventListener("click", function () { if (page < pages) { page++; show(); } });
  closeBtn.addEventListener("click", close);
  lb.addEventListener("click", function (e) { if (e.target === lb || e.target === stage) close(); });
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") prev.click();
    if (e.key === "ArrowRight") next.click();
  });
  document.addEventListener("contextmenu", function (e) {
    if (e.target.tagName === "IMG" && e.target.closest(".td-lb, .td-card")) e.preventDefault();
  });
})();
