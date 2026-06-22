import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'client/src/components/ScheduleCalendar.tsx'), 'utf8');

assert.equal(source.includes('锁车规则'), false, '排期页不应再显示锁车规则黄色设置框');
assert.equal(source.includes('默认定金用于快速填入'), false, '默认定金设置应只放在店铺设置页');
assert.equal(source.includes('DM 单独结算'), true, '早场费/修仙费文案必须说明给 DM 单独结算');
assert.equal(source.includes('不计入店家收入'), true, '早场费/修仙费文案必须说明不计入店家收入');
assert.equal(source.includes('加到每人收款'), false, '早场费/修仙费不应写成店家向玩家收款');

console.log('schedule fee copy smoke passed');
