export function scoreColor(score: number): "red" | "yellow" | "green" {
  if (score < 50) return "red";
  if (score < 75) return "yellow";
  return "green";
}
