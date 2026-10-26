    // =====================================================================
    // Generador de códigos QR (norma ISO/IEC 18004), escrito para NecoVende.
    // Modo byte (UTF-8), versiones 1 a 15, niveles de corrección L / M / Q / H.
    // Se carga solo cuando un comercio abre su QR, así no pesa en el resto del sitio.
    //
    // Uso:  const qr = qrCrear('https://...', 'M');   // { size, modules[y][x] (true = oscuro) }
    // =====================================================================
    const QR_MAX_VERSION = 15;
    const QR_ECC_POR_BLOQUE = {
      L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22],
      M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24],
      Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30],
      H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24]
    };
    const QR_NUM_BLOQUES = {
      L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6],
      M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10],
      Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12],
      H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18]
    };
    const QR_BITS_FORMATO = { L: 1, M: 0, Q: 3, H: 2 };

    function qrModulosCrudos(ver) {
      let r = (16 * ver + 128) * ver + 64;
      if (ver >= 2) {
        const n = Math.floor(ver / 7) + 2;
        r -= (25 * n - 10) * n - 55;
        if (ver >= 7) r -= 36;
      }
      return r;
    }
    function qrCodewordsDatos(ver, ecl) {
      return Math.floor(qrModulosCrudos(ver) / 8) - QR_ECC_POR_BLOQUE[ecl][ver] * QR_NUM_BLOQUES[ecl][ver];
    }

    function qrMultiplicarGF(x, y) {
      let z = 0;
      for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11D);
        z ^= ((y >>> i) & 1) * x;
      }
      return z;
    }
    function qrDivisorRS(grado) {
      const res = new Array(grado).fill(0);
      res[grado - 1] = 1;
      let raiz = 1;
      for (let i = 0; i < grado; i++) {
        for (let j = 0; j < grado; j++) {
          res[j] = qrMultiplicarGF(res[j], raiz);
          if (j + 1 < grado) res[j] ^= res[j + 1];
        }
        raiz = qrMultiplicarGF(raiz, 0x02);
      }
      return res;
    }
    function qrRestoRS(datos, divisor) {
      const res = divisor.map(() => 0);
      for (const b of datos) {
        const factor = b ^ res.shift();
        res.push(0);
        divisor.forEach((coef, i) => { res[i] ^= qrMultiplicarGF(coef, factor); });
      }
      return res;
    }

    function qrPosicionesAlineacion(ver) {
      if (ver === 1) return [];
      const n = Math.floor(ver / 7) + 2;
      const paso = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
      const res = [6];
      for (let pos = ver * 4 + 10; res.length < n; pos -= paso) res.splice(1, 0, pos);
      return res;
    }

    function qrPenalidad(mods, size) {
      let total = 0;
      // Regla 1: rachas de 5 o más módulos iguales (filas y columnas)
      for (let dir = 0; dir < 2; dir++) {
        for (let a = 0; a < size; a++) {
          let racha = 1, previo = dir ? mods[0][a] : mods[a][0];
          for (let b = 1; b < size; b++) {
            const v = dir ? mods[b][a] : mods[a][b];
            if (v === previo) { racha++; if (racha === 5) total += 3; else if (racha > 5) total++; }
            else { racha = 1; previo = v; }
          }
        }
      }
      // Regla 2: bloques de 2x2
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
        const c = mods[y][x];
        if (c === mods[y][x + 1] && c === mods[y + 1][x] && c === mods[y + 1][x + 1]) total += 3;
      }
      // Regla 3: patrón parecido al de las esquinas (1:1:3:1:1) con espacio blanco al lado
      const pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
      for (let dir = 0; dir < 2; dir++) {
        for (let a = 0; a < size; a++) for (let b = 0; b + 11 <= size; b++) {
          let m1 = true, m2 = true;
          for (let k = 0; k < 11 && (m1 || m2); k++) {
            const v = (dir ? mods[b + k][a] : mods[a][b + k]) ? 1 : 0;
            if (v !== pat1[k]) m1 = false;
            if (v !== pat2[k]) m2 = false;
          }
          if (m1) total += 40;
          if (m2) total += 40;
        }
      }
      // Regla 4: proporción de módulos oscuros
      let oscuros = 0;
      for (const fila of mods) for (const v of fila) if (v) oscuros++;
      const k = Math.ceil(Math.abs(oscuros * 20 - size * size * 10) / (size * size)) - 1;
      total += k * 10;
      return total;
    }

    function qrCrear(texto, ecl = 'M') {
      if (!QR_ECC_POR_BLOQUE[ecl]) ecl = 'M';
      const bytes = Array.from(new TextEncoder().encode(String(texto)));

      // 1) Elegir la versión más chica donde entra el texto
      let ver = 1;
      for (; ver <= QR_MAX_VERSION; ver++) {
        const bitsCuenta = ver <= 9 ? 8 : 16;
        if (4 + bitsCuenta + bytes.length * 8 <= qrCodewordsDatos(ver, ecl) * 8) break;
      }
      if (ver > QR_MAX_VERSION) throw new Error('El texto es demasiado largo para el QR');

      // 2) Armar los bits de datos
      const bits = [];
      const poner = (valor, cant) => { for (let i = cant - 1; i >= 0; i--) bits.push((valor >>> i) & 1); };
      poner(0x4, 4);
      poner(bytes.length, ver <= 9 ? 8 : 16);
      bytes.forEach(b => poner(b, 8));
      const capacidad = qrCodewordsDatos(ver, ecl) * 8;
      poner(0, Math.min(4, capacidad - bits.length));
      poner(0, (8 - bits.length % 8) % 8);
      for (let pad = 0xEC; bits.length < capacidad; pad ^= 0xEC ^ 0x11) poner(pad, 8);
      const datos = [];
      for (let i = 0; i < bits.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
        datos.push(b);
      }

      // 3) Corrección de errores e intercalado de bloques
      const nBloques = QR_NUM_BLOQUES[ecl][ver], eccLen = QR_ECC_POR_BLOQUE[ecl][ver];
      const crudos = Math.floor(qrModulosCrudos(ver) / 8);
      const cortos = nBloques - crudos % nBloques, largoCorto = Math.floor(crudos / nBloques);
      const divisor = qrDivisorRS(eccLen);
      const bloques = [];
      for (let i = 0, k = 0; i < nBloques; i++) {
        const dat = datos.slice(k, k + largoCorto - eccLen + (i < cortos ? 0 : 1));
        k += dat.length;
        const ecc = qrRestoRS(dat, divisor);
        if (i < cortos) dat.push(0);
        bloques.push(dat.concat(ecc));
      }
      const final = [];
      for (let i = 0; i < bloques[0].length; i++) {
        bloques.forEach((bl, j) => { if (i !== largoCorto - eccLen || j >= cortos) final.push(bl[i]); });
      }

      // 4) Dibujar la matriz
      const size = ver * 4 + 17;
      const mods = Array.from({ length: size }, () => new Array(size).fill(false));
      const fijo = Array.from({ length: size }, () => new Array(size).fill(false));
      const poneFijo = (x, y, oscuro) => { mods[y][x] = oscuro; fijo[y][x] = true; };

      for (let i = 0; i < size; i++) { poneFijo(6, i, i % 2 === 0); poneFijo(i, 6, i % 2 === 0); }
      const buscador = (cx, cy) => {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) poneFijo(x, y, d !== 2 && d !== 4);
        }
      };
      buscador(3, 3); buscador(size - 4, 3); buscador(3, size - 4);
      const alin = qrPosicionesAlineacion(ver);
      alin.forEach((ay, i) => alin.forEach((ax, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === alin.length - 1) || (i === alin.length - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) poneFijo(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }));

      const dibujarFormato = (mascara) => {
        const dat = (QR_BITS_FORMATO[ecl] << 3) | mascara;
        let resto = dat;
        for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
        const b = ((dat << 10) | resto) ^ 0x5412;
        const bit = i => ((b >>> i) & 1) !== 0;
        for (let i = 0; i <= 5; i++) poneFijo(8, i, bit(i));
        poneFijo(8, 7, bit(6)); poneFijo(8, 8, bit(7)); poneFijo(7, 8, bit(8));
        for (let i = 9; i < 15; i++) poneFijo(14 - i, 8, bit(i));
        for (let i = 0; i < 8; i++) poneFijo(size - 1 - i, 8, bit(i));
        for (let i = 8; i < 15; i++) poneFijo(8, size - 15 + i, bit(i));
        poneFijo(8, size - 8, true);
      };
      dibujarFormato(0);
      if (ver >= 7) {
        let resto = ver;
        for (let i = 0; i < 12; i++) resto = (resto << 1) ^ ((resto >>> 11) * 0x1F25);
        const b = (ver << 12) | resto;
        for (let i = 0; i < 18; i++) {
          const bit = ((b >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3);
          poneFijo(a, c, bit); poneFijo(c, a, bit);
        }
      }

      // 5) Colocar los datos en zigzag
      let idx = 0;
      for (let derecha = size - 1; derecha >= 1; derecha -= 2) {
        if (derecha === 6) derecha = 5;
        for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
          const x = derecha - j, arriba = ((derecha + 1) & 2) === 0, y = arriba ? size - 1 - vert : vert;
          if (!fijo[y][x] && idx < final.length * 8) {
            mods[y][x] = ((final[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0;
            idx++;
          }
        }
      }

      // 6) Elegir la mejor máscara
      const aplicarMascara = (m) => {
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          let inv;
          switch (m) {
            case 0: inv = (x + y) % 2 === 0; break;
            case 1: inv = y % 2 === 0; break;
            case 2: inv = x % 3 === 0; break;
            case 3: inv = (x + y) % 3 === 0; break;
            case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
            case 5: inv = x * y % 2 + x * y % 3 === 0; break;
            case 6: inv = (x * y % 2 + x * y % 3) % 2 === 0; break;
            default: inv = ((x + y) % 2 + x * y % 3) % 2 === 0;
          }
          if (!fijo[y][x] && inv) mods[y][x] = !mods[y][x];
        }
      };
      let mejor = 0, minPen = Infinity;
      for (let m = 0; m < 8; m++) {
        aplicarMascara(m); dibujarFormato(m);
        const pen = qrPenalidad(mods, size);
        if (pen < minPen) { mejor = m; minPen = pen; }
        aplicarMascara(m);
      }
      aplicarMascara(mejor); dibujarFormato(mejor);
      return { size, version: ver, modules: mods };
    }
