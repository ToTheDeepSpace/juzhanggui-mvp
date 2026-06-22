import assert from 'node:assert/strict';
import { STORE_CITIES, searchStoreCities } from '../client/src/utils/chinaCities';

const cityNames = new Set(STORE_CITIES.map(city => city.name));

assert.ok(STORE_CITIES.length >= 380, 'city list should cover Chinese cities and major international cities');
for (const name of ['北京', '上海', '成都', '廊坊', '西双版纳傣族自治州', '阿拉善盟', '伊犁哈萨克自治州', '儋州', '东京', '纽约', '伦敦', '新加坡', '悉尼']) {
  assert.ok(cityNames.has(name), `city list should include ${name}`);
}

assert.equal(searchStoreCities('成都')[0]?.name, '成都', 'direct city search should rank exact match first');
assert.ok(searchStoreCities('四川').some(city => city.name === '成都'), 'province search should include cities in that province');
assert.ok(searchStoreCities('阿拉善').some(city => city.province === '内蒙古'), 'regional search should find leagues/prefectures');
assert.ok(searchStoreCities('日本').some(city => city.name === '东京'), 'country search should include major international cities');
assert.ok(searchStoreCities('美国').some(city => city.name === '纽约'), 'country search should include US major cities');

console.log('store city list smoke passed');
