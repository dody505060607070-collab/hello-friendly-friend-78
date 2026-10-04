export const SITE_URL = "https://www.mithra.work";
export const SITE_NAME = "مثراء العقارية";

export function absoluteSiteUrl(path = "/") {
  return new URL(path, SITE_URL).href;
}