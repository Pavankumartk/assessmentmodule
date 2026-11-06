import localFont from "next/font/local";

// The same Fredoka font used by the supplied game, bundled for offline builds.
export const fredoka = localFont({
  src: "../../../public/quantum-champs/Fredoka.ttf",
  variable: "--qc-font-fredoka",
  weight: "300 700",
  display: "swap",
});
