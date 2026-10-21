// Tandai menu aktif sesuai bagian yang sedang dilihat
const links = document.querySelectorAll(
  '.site-nav .nav-link[href^="#"]:not(.dropdown-toggle)',
);
const sections = [...links]
  .map((l) => document.querySelector(l.getAttribute("href")))
  .filter(Boolean);
function setActiveMenu() {
  const y = window.scrollY + 140;
  let current = sections[0];
  sections.forEach((s) => {
    if (s.offsetTop <= y && s.offsetTop >= current.offsetTop) current = s;
  });
  links.forEach((l) =>
    l.classList.toggle("active", l.getAttribute("href") === "#" + current.id),
  );
}
window.addEventListener("scroll", setActiveMenu);
window.addEventListener("load", setActiveMenu);

// ===== LIGHTBOX: klik foto untuk zoom, tanpa pindah halaman =====
const lightbox = document.createElement("div");
lightbox.className = "lightbox";
lightbox.innerHTML =
  '<button class="lightbox-close" aria-label="Tutup">&times;</button>' +
  '<img alt="" />' +
  '<div class="lightbox-caption"></div>';
document.body.appendChild(lightbox);

const lbImg = lightbox.querySelector("img");
const lbCap = lightbox.querySelector(".lightbox-caption");

function openLightbox(img, caption) {
  lbImg.src = img.src;
  lbImg.alt = img.alt;
  lbCap.textContent = caption || img.alt;
  lightbox.classList.add("show");
  document.body.classList.add("no-scroll");
}

function closeLightbox() {
  lightbox.classList.remove("show");
  document.body.classList.remove("no-scroll");
}

// Foto yang bisa di-zoom: kartu sertifikat dan foto Tentang Saya
document.querySelectorAll(".cert-card, .why-photo").forEach((el) => {
  el.classList.add("zoomable");
  el.addEventListener("click", () => {
    const img = el.tagName === "IMG" ? el : el.querySelector("img");
    const cap = el.querySelector(".cap");
    openLightbox(img, cap ? cap.textContent : "");
  });
});

lightbox.addEventListener("click", closeLightbox);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

// ===== PENCARIAN: cari kata/kalimat di seluruh halaman =====
(function () {
  const form = document.querySelector('.site-nav form[role="search"]');
  if (!form) return;
  const input = form.querySelector("input");
  const navbar = document.querySelector(".site-nav .navbar");
  const menu = document.getElementById("navbarSupportedContent");
  const canHighlight = "highlights" in CSS && typeof Highlight !== "undefined";

  // Kotak kecil berisi jumlah hasil dan tombol naik/turun
  const panel = document.createElement("div");
  panel.className = "search-panel";
  panel.setAttribute("role", "status");
  panel.innerHTML =
    '<span class="search-count"></span>' +
    '<button type="button" class="search-prev" aria-label="Hasil sebelumnya">&#9650;</button>' +
    '<button type="button" class="search-next" aria-label="Hasil berikutnya">&#9660;</button>' +
    '<button type="button" class="search-close" aria-label="Tutup pencarian">&times;</button>';
  document.body.appendChild(panel);
  const countEl = panel.querySelector(".search-count");

  let ranges = [];
  let current = 0;
  let lastQuery = "";
  let timer;

  // Bagian halaman yang dicari (navbar dan pop-up foto tidak ikut dicari)
  function roots() {
    return document.querySelectorAll("body > section, body > footer");
  }

  // Elemen "blok" terdekat, supaya teks di kotak berbeda tidak menyatu
  function blockOf(node) {
    let el = node.parentElement;
    while (el && getComputedStyle(el).display === "inline")
      el = el.parentElement;
    return el;
  }

  // Ubah isi satu bagian jadi satu teks panjang (huruf kecil, spasi dirapikan)
  // sambil mengingat posisi asli setiap huruf
  function buildIndex(root) {
    const map = [];
    let text = "";
    let lastBlock = null;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (
          !p ||
          p.closest(
            "script, style, noscript, textarea, .search-panel, .lightbox",
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const blk = blockOf(node);
      if (lastBlock && blk !== lastBlock && text && !text.endsWith(" ")) {
        text += " ";
        map.push({ n: node, o: 0 });
      }
      lastBlock = blk;
      const s = node.nodeValue;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (/\s/.test(c)) {
          if (text && !text.endsWith(" ")) {
            text += " ";
            map.push({ n: node, o: i });
          }
        } else {
          for (const ch of c.toLowerCase()) {
            text += ch;
            map.push({ n: node, o: i });
          }
        }
      }
    }
    return { text, map };
  }

  function findAll(q) {
    const found = [];
    roots().forEach((root) => {
      const { text, map } = buildIndex(root);
      let pos = 0;
      while ((pos = text.indexOf(q, pos)) !== -1) {
        const a = map[pos];
        const b = map[pos + q.length - 1];
        const r = document.createRange();
        r.setStart(a.n, a.o);
        r.setEnd(b.n, b.o + 1);
        found.push(r);
        pos += q.length;
      }
    });
    return found;
  }

  function placePanel() {
    panel.style.top = navbar.getBoundingClientRect().bottom + 8 + "px";
  }

  function showPanel(message, none) {
    countEl.textContent = message;
    panel.classList.toggle("none", !!none);
    panel.classList.add("show");
    placePanel();
  }

  function paint() {
    CSS.highlights.set("search-hit", new Highlight(...ranges));
    const cur = new Highlight(ranges[current]);
    cur.priority = 1;
    CSS.highlights.set("search-current", cur);
  }

  function clearAll() {
    ranges = [];
    lastQuery = "";
    if (canHighlight) {
      CSS.highlights.delete("search-hit");
      CSS.highlights.delete("search-current");
    }
    panel.classList.remove("show");
  }

  function go(i) {
    current = (i + ranges.length) % ranges.length;
    paint();
    showPanel(current + 1 + " dari " + ranges.length, false);
    const el = ranges[current].startContainer.parentElement;
    if (el)
      el.scrollIntoView({
        block: "center",
        inline: "center",
        behavior: "smooth",
      });
  }

  function search(raw) {
    const q = raw.trim().replace(/\s+/g, " ").toLowerCase();
    if (!q) {
      clearAll();
      return;
    }
    if (!canHighlight) {
      window.find(raw, false, false, true);
      return;
    }
    lastQuery = q;
    if (q.length < 2) {
      ranges = [];
      CSS.highlights.delete("search-hit");
      CSS.highlights.delete("search-current");
      showPanel("Ketik minimal 2 huruf", true);
      return;
    }
    ranges = findAll(q);
    if (!ranges.length) {
      CSS.highlights.delete("search-hit");
      CSS.highlights.delete("search-current");
      showPanel("Tidak ditemukan", true);
      return;
    }
    go(0);
  }

  function normalized() {
    return input.value.trim().replace(/\s+/g, " ").toLowerCase();
  }

  // Enter / tombol Search: hasil pertama, lalu berikutnya kalau kata sama
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (canHighlight && ranges.length && normalized() === lastQuery)
      go(current + 1);
    else search(input.value);
    // di HP, tutup menu supaya hasilnya terlihat
    if (menu.classList.contains("show") && window.innerWidth < 992) {
      bootstrap.Collapse.getOrCreateInstance(menu).hide();
    }
  });

  // Shift + Enter: kembali ke hasil sebelumnya
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.shiftKey && ranges.length) {
      e.preventDefault();
      go(current - 1);
    }
  });

  // Hasil langsung muncul saat mengetik
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => search(input.value), 250);
  });
  input.addEventListener("search", () => {
    if (!input.value) clearAll();
  });

  panel
    .querySelector(".search-next")
    .addEventListener("click", () => ranges.length && go(current + 1));
  panel
    .querySelector(".search-prev")
    .addEventListener("click", () => ranges.length && go(current - 1));
  panel.querySelector(".search-close").addEventListener("click", () => {
    input.value = "";
    clearAll();
  });

  // Posisi kotak hasil ikut menyesuaikan saat menu dibuka/ditutup atau layar berubah
  menu.addEventListener("shown.bs.collapse", placePanel);
  menu.addEventListener("hidden.bs.collapse", placePanel);
  window.addEventListener("resize", placePanel);
})();
