const FARMER_PHONE_NUMBERS = new Set([
  "+639170000001",
  "+639170000002",
]);

export const normalizePhilippinePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("63")) return `+${digits}`;
  if (digits.startsWith("0")) return `+63${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 10) return `+63${digits}`;
  return phone.trim();
};

export const isDesignatedFarmerPhone = (
  phone: string | null | undefined,
): boolean =>
  phone !== null &&
  phone !== undefined &&
  FARMER_PHONE_NUMBERS.has(normalizePhilippinePhone(phone));
