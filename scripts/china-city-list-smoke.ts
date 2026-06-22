import assert from 'node:assert/strict';
import { CHINA_CITIES, searchChinaCities } from '../client/src/utils/chinaCities';

const cityNames = new Set(CHINA_CITIES.map(city => city.name));

assert.ok(CHINA_CITIES.length >= 330, 'city list should cover mainland prefecture-level and direct-admin cities');
for (const name of ['北京', '上海', '成都', '廊坊', '西双版纳傣族自治州', '阿拉善盟', '伊犁哈萨克自治州', '儋州']) {
  assert.ok(cityNames.has(name), `city list should include ${name}`);
}

assert.equal(searchChinaCities('成都')[0]?.name, '成都', 'direct city search should rank exact match first');
assert.ok(searchChinaCities('四川').some(city => city.name === '成都'), 'province search should include cities in that province');
assert.ok(searchChinaCities('阿拉善').some(city => city.province === '内蒙古'), 'regional search should find leagues/prefectures');

console.log('china city list smoke passed');
