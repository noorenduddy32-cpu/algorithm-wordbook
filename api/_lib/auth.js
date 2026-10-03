// 登录态：用 HMAC 签名的 HttpOnly Cookie 保存角色（visitor / admin）。
// 密钥与密码只存在服务端环境变量，绝不进前端。
const crypto = require('crypto');
const { parseCookies } = require('./http');

const NAME = 'an_sess';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 天
const SECRET = process.env.SESSION_SECRET || 'dev-insecure-change-me';
const SECURE = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

function b64u(buf) { return Buffer.from(buf).toString('base64url'); }

function sign(role) {
  const payload = b64u(JSON.stringify({ role: role, exp: Date.now() + MAX_AGE * 1000 }));
  const sig = b64u(crypto.createHmac('sha256', SECRET).update(payload).digest());
  return payload + '.' + sig;
}

function verify(cookie) {
  if (!cookie) return null;
  const parts = String(cookie).split('.');
  if (parts.length !== 2) return null;
  const expect = b64u(crypto.createHmac('sha256', SECRET).update(parts[0]).digest());
  const a = Buffer.from(expect), b = Buffer.from(parts[1]);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  let obj;
  try { obj = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); } catch (e) { return null; }
  if (!obj.exp || obj.exp < Date.now()) return null;
  return obj.role;
}

function roleFromReq(req) {
  const cookies = parseCookies(req);
  return verify(cookies[NAME]);
}

function setCookie(res, value) {
  const parts = [NAME + '=' + value, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=' + MAX_AGE];
  if (SECURE) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearCookie(res) {
  const parts = [NAME + '=; HttpOnly; Path=/; Max-Age=0'];
  if (SECURE) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

module.exports = {
  NAME: NAME, MAX_AGE: MAX_AGE, SECRET: SECRET,
  sign: sign, verify: verify, roleFromReq: roleFromReq,
  setCookie: setCookie, clearCookie: clearCookie
};
