import test from 'node:test';
import assert from 'node:assert/strict';
import { lab } from './helpers.mjs';
const mode = process.env.LAB_MODE || 'fixed';
test('Студент А не может читать работу Б', async t => {
  const l=await lab(t,mode); const cookie=await l.login('student-a','lab-a');
  const r=await l.request('/api/works/102',cookie);
  assert.equal(r.status,403); assert.equal((await r.json()).owner,undefined);
});
test('Студент Б не может читать работу А', async t => {
  const l=await lab(t,mode); const cookie=await l.login('student-b','lab-b');
  assert.equal((await l.request('/api/works/101',cookie)).status,403);
});
test('Студент не может открыть список преподавателя', async t => {
  const l=await lab(t,mode); const cookie=await l.login('student-a','lab-a');
  assert.equal((await l.request('/api/teacher/works',cookie)).status,403);
});
test('Без входа доступ закрыт', async t => {
  const l=await lab(t,mode);
  for(const path of ['/api/works/101','/api/works','/api/teacher/works']) assert.equal((await l.request(path)).status,401);
});
test('Свою работу студент читает', async t => {
  const l=await lab(t,mode); const cookie=await l.login('student-a','lab-a');
  assert.equal((await l.request('/api/works/101',cookie)).status,200);
});
test('Преподаватель видит обе работы', async t => {
  const l=await lab(t,mode); const cookie=await l.login('teacher','lab-teacher');
  const r=await l.request('/api/teacher/works',cookie);assert.equal(r.status,200);assert.equal((await r.json()).length,2);
});
test('Студент не может изменить оценку', async t => {
  const l=await lab(t,mode); const cookie=await l.login('student-a','lab-a');
  assert.equal((await l.request('/api/works/101',cookie,'PATCH',{grade:5})).status,403);
  assert.equal((await (await l.request('/api/works/101',cookie)).json()).grade,4);
});
  
