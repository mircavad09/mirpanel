const REPO = "mircavad09/mirpanel";
const BRANCH = "main";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function findObjectBlock(source, marker) {
  const markerStart = source.indexOf(marker);
  if (markerStart < 0) throw new Error(`${marker} tapılmadı.`);

  const start = source.indexOf("{", markerStart);
  if (start < 0) throw new Error(`${marker} bloku tapılmadı.`);

  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") depth += 1;

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        let end = index + 1;
        while (source[end] && /[\s;]/.test(source[end])) end += 1;
        return { markerStart, start, end, text: source.slice(start, index + 1) };
      }
    }
  }

  throw new Error(`${marker} bloku bağlanmayıb.`);
}

function parseData(source) {
  const block = findObjectBlock(source, "const DATA");
  return {
    block,
    data: JSON.parse(block.text)
  };
}

function replaceData(source, block, data) {
  return `${source.slice(0, block.markerStart)}const DATA = ${JSON.stringify(data, null, 2)};\n\n${source.slice(block.end)}`;
}

function decodeBase64(value) {
  const binary = atob(String(value || "").replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function github(env, pathname, init = {}) {
  const token = env.MIRPANEL_GITHUB_TOKEN;
  if (!token) throw new Error("MIRPANEL_GITHUB_TOKEN təyin edilməyib.");

  const response = await fetch(`https://api.github.com${pathname}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "mirpanel-stock",
      ...(init.headers || {})
    }
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `GitHub xətası: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function getRepoFile(env, path) {
  const file = await github(env, `/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`);
  return {
    sha: file.sha,
    source: decodeBase64(file.content)
  };
}

function bumpAssetVersions(source, version) {
  return source
    .replace(/app\.js\?v=[^"]+/g, `app.js?v=${version}`)
    .replace(/order-confirmation\.js\?v=[^"]+/g, `order-confirmation.js?v=${version}`);
}

async function decrementOnce(env, productId) {
  const current = await getRepoFile(env, "app.js");
  const { block, data } = parseData(current.source);
  const product = data.products?.find((item) => item.id === productId);

  if (!product) {
    return { ok: false, status: 404, body: { error: "Məhsul tapılmadı." } };
  }

  if (product.active === false || product.soldOut === true) {
    return { ok: false, status: 409, body: { error: "Stokda yoxdur." } };
  }

  if (product.stockEnabled !== true || product.stock === null || product.stock === "" || product.stock === undefined) {
    return { ok: true, body: { skipped: true, productId, stockBefore: null, stockAfter: null } };
  }

  const before = Number(product.stock);
  if (!Number.isFinite(before) || before <= 0) {
    product.stock = 0;
    product.soldOut = true;
    return { ok: false, status: 409, body: { error: "Stokda yoxdur.", stockBefore: Math.max(0, before || 0), stockAfter: 0 } };
  }

  const after = Math.max(0, before - 1);
  product.stock = after;
  product.soldOut = after === 0;

  const patched = replaceData(current.source, block, data);
  const result = await github(env, `/repos/${REPO}/contents/app.js`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Decrement stock for ${productId}`,
      content: encodeBase64(patched),
      sha: current.sha,
      branch: BRANCH
    })
  });

  let cacheCommitSha = "";
  try {
    const indexFile = await getRepoFile(env, "index.html");
    const version = `stock-${Date.now()}`;
    const patchedIndex = bumpAssetVersions(indexFile.source, version);
    if (patchedIndex !== indexFile.source) {
      const cacheResult = await github(env, `/repos/${REPO}/contents/index.html`, {
        method: "PUT",
        body: JSON.stringify({
          message: "Bump Mirpanel asset cache version",
          content: encodeBase64(patchedIndex),
          sha: indexFile.sha,
          branch: BRANCH
        })
      });
      cacheCommitSha = cacheResult.commit.sha;
    }
  } catch (error) {
    console.error("Cache bump failed", error);
  }

  return {
    ok: true,
    body: {
      productId,
      stockBefore: before,
      stockAfter: after,
      soldOut: after === 0,
      commitSha: result.commit.sha,
      cacheCommitSha
    }
  };
}

export async function onRequestPost(context) {
  let productId = "";

  try {
    const body = await context.request.json().catch(() => ({}));
    productId = String(body.productId || "").trim();

    if (!productId) {
      return json({ error: "productId tələb olunur." }, 400);
    }

    const result = await decrementOnce(context.env, productId);
    return json(result.body, result.ok ? 200 : result.status || 500);
  } catch (error) {
    if (error.status === 409 && productId) {
      try {
        const retry = await decrementOnce(context.env, productId);
        return json(retry.body, retry.ok ? 200 : retry.status || 409);
      } catch (retryError) {
        return json({ error: retryError.message || "Stok yenilənmədi." }, retryError.status || 500);
      }
    }

    return json({ error: error.message || "Stok yenilənmədi." }, error.status || 500);
  }
}
