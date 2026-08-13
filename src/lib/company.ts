import { prisma } from "@/lib/prisma";

export async function getCompany() {
  let company = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: "My Business",
        currency: "TTD",
        vatRate: 0.125,
        businessType: "BOTH",
        theme: "light",
        language: "en",
        homeLayout: "RETAIL",
        receiptPrinting: true,
      },
    });
  }
  return company;
}
