import https from "https";

// Unbelievable that it is easier to me to write this snippet rather than install node-fetch!

export function fetchJson(url: string) {
  return new Promise<any>((resolve, reject) => {
    https.get(url, (res) => {
      let body = "";

      res.on("data", (chunk) => {
        body += chunk;
      });

      res.on("end", () => {
        const json = JSON.parse(body);
        resolve(json);
      });
      res.on("error", (e) => {
        reject(e);
      });
    });
  });
}
