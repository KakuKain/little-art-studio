// Fixed colors, in the order the color panel shows them (six a row).
export const PALETTE = [
  { color: "#ff7399", name: "粉紅" },
  { color: "#e95c57", name: "紅" },
  { color: "#ffae62", name: "橘" },
  { color: "#ffe16b", name: "黃" },
  { color: "#7ccca0", name: "綠" },
  { color: "#74b9ed", name: "藍" },
  { color: "#ac8bd8", name: "紫" },
  { color: "#f4b7ce", name: "淡粉" },
  { color: "#cde9c4", name: "淡綠" },
  { color: "#e0a23e", name: "金黃" },
  { color: "#358a6c", name: "深綠" },
  { color: "#476cbb", name: "深藍" },
  { color: "#ffe2cc", name: "淺膚色" },
  { color: "#f3bf98", name: "膚色" },
  { color: "#b97d58", name: "深膚色" },
  { color: "#845e49", name: "棕" },
  { color: "#333948", name: "黑" },
  { color: "#ffffff", name: "白" },
];
// The quick colors under the canvas. Skin and brown are here for faces and
// hair; the others are one tap away in the color panel.
export const QUICK_COLORS = ["粉紅", "黃", "綠", "藍", "紫", "膚色", "棕"].map(
  (name) => PALETTE.find((entry) => entry.name === name),
);
