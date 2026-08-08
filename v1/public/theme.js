// Light/dark toggle. The initial theme (from localStorage, before any OS
// preference fallback) is already applied by the inline script in <head> —
// this file only wires up the button and keeps its icon in sync.

const themeToggleBtn = document.getElementById("theme-toggle");

function activeTheme() {
  return document.documentElement.dataset.theme || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("fli:theme", theme);
  updateThemeIcon();
}

function updateThemeIcon() {
  // Icon shows what clicking would switch TO, not the current state.
  themeToggleBtn.textContent = activeTheme() === "light" ? "🌙" : "☀️";
}

themeToggleBtn.addEventListener("click", () => {
  setTheme(activeTheme() === "light" ? "dark" : "light");
});

updateThemeIcon();
