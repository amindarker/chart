// این اسکریپت رو GitHub Actions اجرا می‌کنه، نیازی نیست خودت دستی اجراش کنی.
// از API نوشن، ستون «تاریخ» و «ساعت» رو از دیتابیس «لیست وظایف» می‌گیره
// و مجموع ساعت هر روز رو تو یه فایل data.json می‌ریزه.

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID; // بدون خط تیره یا با خط تیره، هردو کار می‌کنه

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error("NOTION_TOKEN یا DATABASE_ID تنظیم نشده");
  process.exit(1);
}

async function main() {
  let allResults = [];
  let cursor = undefined;

  do {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cursor ? { start_cursor: cursor } : {}),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion API error: ${res.status} ${text}`);
    }

    const json = await res.json();
    allResults = allResults.concat(json.results);
    cursor = json.has_more ? json.next_cursor : undefined;
  } while (cursor);

  // جمع ساعت هر روز
  const perDay = {};

  for (const page of allResults) {
    const props = page.properties;
    const dateProp = props["تاریخ"]?.date?.start;
    const hoursProp = props["ساعت"]?.number;

    if (!dateProp || hoursProp == null) continue;

    const day = dateProp.slice(0, 10); // فقط YYYY-MM-DD
    perDay[day] = (perDay[day] || 0) + hoursProp;
  }

  const labels = Object.keys(perDay).sort();
  const values = labels.map((d) => perDay[d]);

  const output = {
    labels,
    values,
    updatedAt: new Date().toISOString(),
  };

  const fs = await import("fs");
  fs.writeFileSync("data.json", JSON.stringify(output, null, 2));
  console.log(`data.json نوشته شد — ${labels.length} روز`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
