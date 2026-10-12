const topbar = document.querySelector(".topbar");
const updateTopbar = () => topbar.classList.toggle("is-scrolled", window.scrollY > 12);
window.addEventListener("scroll", updateTopbar, { passive: true });
updateTopbar();

const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
menuToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});
navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  navLinks.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
}));
document.getElementById("year").textContent = new Date().getFullYear();

const form = document.getElementById("contactForm");
const status = document.getElementById("formStatus");
const submitButton = form.querySelector("button[type='submit']");
const submitText = document.getElementById("submitText");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "";
  status.classList.remove("error");
  submitButton.disabled = true;
  submitText.textContent = "Sending…";

  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.message || "Message could not be sent.");
    status.textContent = result.message;
    form.reset();
  } catch (error) {
    status.textContent = error.message || "Message could not be sent. Please try again.";
    status.classList.add("error");
  } finally {
    submitButton.disabled = false;
    submitText.textContent = "Send message";
  }
});