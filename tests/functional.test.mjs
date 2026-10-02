import test from 'node:test';
import assert from 'node:assert/strict';
import { lab } from './helpers.mjs';
test('Уязвимый режим воспроизводит IDOR и отсутствие проверки роли', async t => {
 const l=await lab(t,'vulnerable');const cookie=await l.login('student-a','lab-a');
 const r=await l.request('/api/works/102',cookie);assert.equal(r.status,200);assert.equal((await r.json()).owner,'student-b');
 assert.equal((await l.request('/api/teacher/works',cookie)).status,200);
});
test('Неверный пароль не создаёт сеанс',async t=>{
 const l=await lab(t);const r=await l.request('/api/login',null,'POST',{login:'teacher',password:'wrong'});
 assert.equal(r.status,401);assert.equal(r.headers.get('set-cookie'),null);
});
test('Выход аннулирует прежнюю cookie',async t=>{
 const l=await lab(t);const cookie=await l.login('student-a','lab-a');
 await l.request('/api/logout',cookie,'POST');assert.equal((await l.request('/api/works/101',cookie)).status,401);
});
test('Список студента содержит только его работу',async t=>{
 const l=await lab(t);const cookie=await l.login('student-b','lab-b');
 assert.deepEqual((await (await l.request('/api/works',cookie)).json()).map(w=>w.id),[102]);
});
test('Преподаватель меняет оценку и студент видит изменение',async t=>{
 const l=await lab(t);const teacher=await l.login('teacher','lab-teacher');
 assert.equal((await l.request('/api/works/101',teacher,'PATCH',{grade:3})).status,200);
 const student=await l.login('student-a','lab-a');assert.equal((await (await l.request('/api/works/101',student)).json()).grade,3);
});
test('Неверные оценки отклоняются',async t=>{
 const l=await lab(t);const cookie=await l.login('teacher','lab-teacher');
 for(const grade of [0,1,6,99,3.5,'5',null,{},[]]) assert.equal((await l.request('/api/works/101',cookie,'PATCH',{grade})).status,400);
 assert.equal((await (await l.request('/api/works/101',cookie)).json()).grade,4);
});
test('Некорректный JSON в login не приводит к падению',async t=>{
 const l=await lab(t);const r=await l.raw('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'});assert.equal(r.status,400);
 assert.equal((await l.request('/api/health')).status,200);
});
test('Неизвестный номер не раскрывает данные',async t=>{
 const l=await lab(t);const cookie=await l.login('teacher','lab-teacher');assert.equal((await l.request('/api/works/999',cookie)).status,404);
});
test('Подмена роли заголовком и полем login не даёт привилегий',async t=>{
 const l=await lab(t);const r=await l.request('/api/login',null,'POST',{login:'student-a',password:'lab-a',role:'teacher'});
 assert.equal((await r.json()).role,'student');const cookie=r.headers.get('set-cookie').split(';')[0];
 assert.equal((await l.raw('/api/teacher/works',{headers:{cookie,'X-Role':'teacher'}})).status,403);
});
test('Отказ пишется в журнал без паролей и cookie',async t=>{
 const l=await lab(t);const cookie=await l.login('student-a','lab-a');await l.request('/api/works/102',cookie);
 const e=l.events.at(-1);assert.equal(e.status,403);assert.equal(e.actor,'student-a');assert.equal(e.path,'/api/works/102');
 assert.ok(!JSON.stringify(l.events).includes('lab-a'));assert.ok(!JSON.stringify(l.events).includes(cookie));
});
