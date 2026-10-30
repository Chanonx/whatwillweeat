// ใช้เฉพาะตอนเทส: จำลอง API gateway ของ Supabase → ส่ง /rest/v1/* ต่อไปที่ PostgREST
import http from "node:http";

const target = Number(process.env.POSTGREST_PORT ?? 3001);
const port = Number(process.env.GATEWAY_PORT ?? 54321);

http
  .createServer((req, res) => {
    if (!req.url.startsWith("/rest/v1")) {
      res.writeHead(404).end("not found");
      return;
    }
    const upstream = http.request(
      { host: "127.0.0.1", port: target, path: req.url.slice("/rest/v1".length) || "/", method: req.method, headers: req.headers },
      (r) => {
        res.writeHead(r.statusCode, r.headers);
        r.pipe(res);
      },
    );
    upstream.on("error", (e) => res.writeHead(502).end(String(e)));
    req.pipe(upstream);
  })
  .listen(port, () => console.log(`gateway :${port} → postgrest :${target}`));
