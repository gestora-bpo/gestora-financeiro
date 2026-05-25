const https = require("https");

module.exports = async function (context, req) {
  const { omieEndpoint, call, params } = req.body || {};

  if (!omieEndpoint || !call || !params) {
    context.res = { status: 400, body: { error: "Campos obrigatórios: omieEndpoint, call, params" } };
    return;
  }

  const APP_KEY    = process.env.OMIE_APP_KEY;
  const APP_SECRET = process.env.OMIE_APP_SECRET;

  if (!APP_KEY || !APP_SECRET) {
    context.res = { status: 500, body: { error: "Credenciais Omie não configuradas" } };
    return;
  }

  const payload = JSON.stringify({
    call,
    app_key: APP_KEY,
    app_secret: APP_SECRET,
    param: [params],
  });

  try {
    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: "app.omie.com.br",
        port: 443,
        path: `/api/v1${omieEndpoint}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      };
      const request = https.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(new Error("Resposta inválida do Omie")); }
        });
      });
      request.on("error", reject);
      request.write(payload);
      request.end();
    });
    context.res = { status: 200, headers: { "Content-Type": "application/json" }, body: data };
  } catch (error) {
    context.res = { status: 500, body: { error: error.message } };
  }
};
