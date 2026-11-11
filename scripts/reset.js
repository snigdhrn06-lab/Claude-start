process.env.CB_DISABLE_AI = '1';
const { seed, counts } = await import('../server/seed.js');
await seed({ force: true });
console.log('Demo data reset:', counts());
process.exit(0);
