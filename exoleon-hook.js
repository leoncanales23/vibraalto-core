document.addEventListener("DOMContentLoaded", () => {
  const enterBtn = document.getElementById("enterBtn");
  const ageGate = document.getElementById("age-gate");
  const mainContent = document.getElementById("main-content");

  enterBtn.addEventListener("click", () => {
    ageGate.classList.add("hidden");
    mainContent.classList.remove("hidden");
    document.body.style.overflow = "auto";

    // Hook ExoLeón: mensaje animado en consola
    console.log("%c⚡ Bienvenido a VibraAlto + ExoLeón", "color: gold; font-size:16px; font-weight:bold;");
    console.log("%cConectando inteligencia, diseño y energía.", "color: #ccc;");
  });
});
