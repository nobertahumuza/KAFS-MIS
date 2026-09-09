import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

async function main() {
  await prisma.appSetting.update({
    where: { settingKey: "sms_base_url" },
    data: { settingValue: "https://www.egosms.co/api/v1/plain/" },
  })
  console.log("SMS URL updated to: https://www.egosms.co/api/v1/plain/")
}

main().then(() => prisma.$disconnect())
