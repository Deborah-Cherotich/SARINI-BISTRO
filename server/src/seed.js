const { initDb } = require("./db");
const { seedAll } = require("./seed-functions");

initDb().then(() => {
  seedAll();
  console.log("Seed complete.");
});
