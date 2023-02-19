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
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
      res.on("error", (e) => {
        reject(e);
      });
    });
  });
}

export async function fetchJsonNoFail(url: string) {
  while (true) {
    const data = await fetchJson(url).catch((e) => null);
    if (data !== null) {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.info(`Retrying...`);
  }
}
