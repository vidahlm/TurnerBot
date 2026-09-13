const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Convierte un número o BigInt a una cadena Base62.

function encodeBase62(value) {
  let n = BigInt(value);
  if (n === 0n) return ALPHABET[0];
  let result = "";
  while (n > 0n) {
    const remainder = n % 62n;
    result = ALPHABET[Number(remainder)] + result;
    n = n / 62n;
  }
  return result;
}

// Decodifica una cadena Base62 a un BigInt.

function decodeBase62(str) {
  let n = 0n;
  for (let i = 0; i < str.length; i++) {
    const index = ALPHABET.indexOf(str[i]);
    if (index === -1)
      throw new Error(`Carácter inválido '${str[i]}' en Base62.`);
    n = n * 62n + BigInt(index);
  }
  return n;
}

// Genera un checksum de 4 caracteres mediante el algoritmo FNV-1a (32-bit).

function createChecksum(payload) {
  let hash = 2166136261n; // Valor inicial FNV offset basis
  for (let i = 0; i < payload.length; i++) {
    hash ^= BigInt(payload.charCodeAt(i));
    hash = (hash * 16777619n) & 0xffffffffn; // FNV prime con máscara de 32 bits
  }
  return encodeBase62(hash).padStart(4, "0");
}

/**
  Empaqueta la información en un Token completo.
  Formato: TYPE-INDEX_B62-USERID_B62-CHECKSUM
 */
function generateToken(planWho, indexNum, discordId, planType) {
  const b62Index = encodeBase62(indexNum);
  const b62User = encodeBase62(discordId);
  const rawPayload = `${planWho}-${b62Index}-${b62User}-${planType}`;
  const checksum = createChecksum(rawPayload);
  return `${rawPayload}-${checksum}`;
}

// Valida y descompone un Token recibido.

function parseAndValidateToken(tokenString) {
  const parts = tokenString.trim().split("-");
  if (parts.length !== 5)
    return { valid: false, reason: "Estructura de token inválida." };

  const [planWho, b62Index, b62User, checksum] = parts;
  const rawPayload = `${planWho}${b62Index}-${b62User}${planType}`;
  const expectedChecksum = createChecksum(rawPayload);

  if (checksum !== expectedChecksum) {
    return {
      valid: false,
      reason: "Unvalid Checksum (Alterado o mal digitado).",
    };
  }

  return {
    valid: true,
    planWho,
    index: Number(decodeBase62(b62Index)),
    discordId: decodeBase62(b62User).toString(),
  };
}

module.exports = {
  encodeBase62,
  decodeBase62,
  createChecksum,
  generateToken,
  parseAndValidateToken,
};
