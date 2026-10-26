    async function comprimirImagenCliente(file, maxAncho = 800, maxAlto = 800, calidad = 0.8) {
      return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
          resolve(file);
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxAncho) {
                height = Math.round((height * maxAncho) / width);
                width = maxAncho;
              }
            } else {
              if (height > maxAlto) {
                width = Math.round((width * maxAlto) / height);
                height = maxAlto;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const compressedFile = new File([blob], `opt_${Date.now()}.webp`, {
                type: 'image/webp',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            }, 'image/webp', calidad);
          };
          img.onerror = (err) => resolve(file);
        };
        reader.onerror = (err) => resolve(file);
      });
    }

    function crearSlug(texto) {
      if (!texto) return '';
      return texto.toString().toLowerCase().trim().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    }

    function abrirMapaDireccion(direccionLocal) {
      const query = encodeURIComponent(`${direccionLocal}, Necochea, Buenos Aires`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }

    function compartirOlinkComercio() {
      if (!comercioActivo) return;
      const identificador = comercioActivo.slug || comercioActivo.id;
      const url = `${window.location.origin}${window.location.pathname}?menu=${identificador}`;

      if (navigator.share) {
        navigator.share({
          title: comercioActivo.nombre,
          text: `¡Mirá el catálogo de ${comercioActivo.nombre} en NecoVende!`,
          url: url
        }).catch(err => console.error("Error compartiendo:", err));
      } else {
        navigator.clipboard.writeText(url).then(() => {
          alert("¡Link del local copiado al portapapeles!");
        }).catch(err => console.error("Error al copiar link:", err));
      }
    }

    function toggleCampoCostoEnvio() {
      const tieneEnvios = document.getElementById('envios').checked;
      const esGratis = document.getElementById('envio-gratis').checked;
      const contenedor = document.getElementById('contenedor-costo-envio');

      if (tieneEnvios && !esGratis) {
        contenedor.classList.remove('hidden');
      } else {
        contenedor.classList.add('hidden');
      }
    }

    function toggleCheckDiaCerrado(diaId) {
      const cerrado = document.getElementById(`chk-cerrado-${diaId}`).checked;
      const inputs = document.querySelectorAll(`.horario-inputs-${diaId}`);
      inputs.forEach(inp => {
        inp.disabled = cerrado;
        if (cerrado) inp.classList.add('opacity-40', 'bg-slate-100');
        else inp.classList.remove('opacity-40', 'bg-slate-100');
      });
    }

    function cambiarTipoModalHorarios() {
      const tipo = document.getElementById('modal-tipo-horario').value;
      const horariosActuales = obtenerHorariosFormulario();
      renderizarGrillaHorarios(horariosActuales, tipo);
    }

    function autocompletarHorariosMismo() {
      const tipo = document.getElementById('modal-tipo-horario').value;
      const d1Cerrado = document.getElementById(`chk-cerrado-lun`).checked;
      const d1Desde = document.getElementById(`horario-desde-lun`).value.trim();
      const d1Hasta = document.getElementById(`horario-hasta-lun`).value.trim();
      
      let d1Desde2 = '', d1Hasta2 = '';
      if (tipo === 'cortado') {
        const elD2 = document.getElementById(`horario-desde2-lun`);
        const elH2 = document.getElementById(`horario-hasta2-lun`);
        if (elD2) d1Desde2 = elD2.value.trim();
        if (elH2) d1Hasta2 = elH2.value.trim();
      }

      DIAS_SEMANA.forEach(d => {
        const chk = document.getElementById(`chk-cerrado-${d.id}`);
        if (chk) chk.checked = d1Cerrado;
        
        const inD1 = document.getElementById(`horario-desde-${d.id}`);
        if (inD1) inD1.value = d1Desde;
        
        const inH1 = document.getElementById(`horario-hasta-${d.id}`);
        if (inH1) inH1.value = d1Hasta;

        if (tipo === 'cortado') {
          const inD2 = document.getElementById(`horario-desde2-${d.id}`);
          if (inD2) inD2.value = d1Desde2;
          const inH2 = document.getElementById(`horario-hasta2-${d.id}`);
          if (inH2) inH2.value = d1Hasta2;
        }

        toggleCheckDiaCerrado(d.id);
      });
      mostrarToast("¡Horarios aplicados a todos los días!");
    }

    function renderizarGrillaHorarios(horariosGuardados = {}, tipoHorarioPredeterminado = 'corrido') {
      const container = document.getElementById('grilla-horarios-dias');
      container.innerHTML = '';

      let esCortado = tipoHorarioPredeterminado === 'cortado';
      if (horariosGuardados && Object.keys(horariosGuardados).length > 0) {
        esCortado = Object.values(horariosGuardados).some(h => h.tipo === 'cortado' || (h.desde2 && h.hasta2));
      }
      
      const selectTipo = document.getElementById('modal-tipo-horario');
      if (selectTipo) selectTipo.value = esCortado ? 'cortado' : 'corrido';

      DIAS_SEMANA.forEach(d => {
        const datosDia = horariosGuardados[d.id] || { cerrado: false, desde: '09:00', hasta: '13:00', desde2: '17:00', hasta2: '21:00' };
        
        container.innerHTML += `
          <div class="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
            <div class="flex items-center justify-between sm:w-28">
              <span class="font-bold text-slate-800">${d.nombre}</span>
              <label class="flex items-center gap-1.5 cursor-pointer text-[11px] text-rose-600 font-semibold">
                <input type="checkbox" id="chk-cerrado-${d.id}" ${datosDia.cerrado ? 'checked' : ''} onchange="toggleCheckDiaCerrado('${d.id}')" class="rounded border-slate-300 text-rose-600 focus:ring-rose-500">
                Cerrado
              </label>
            </div>
            <div class="flex flex-col sm:flex-row items-center gap-1.5">
              <div class="flex items-center gap-1">
                <input type="text" id="horario-desde-${d.id}" value="${datosDia.desde || '09:00'}" placeholder="09:00" class="clean-input horario-inputs-${d.id} px-2 py-1 rounded-lg text-xs font-semibold w-16 text-center ${datosDia.cerrado ? 'opacity-40 bg-slate-100' : ''}" ${datosDia.cerrado ? 'disabled' : ''}>
                <span class="text-slate-400 text-xs">a</span>
                <input type="text" id="horario-hasta-${d.id}" value="${datosDia.hasta || '13:00'}" placeholder="13:00" class="clean-input horario-inputs-${d.id} px-2 py-1 rounded-lg text-xs font-semibold w-16 text-center ${datosDia.cerrado ? 'opacity-40 bg-slate-100' : ''}" ${datosDia.cerrado ? 'disabled' : ''}>
              </div>
              ${esCortado ? `
                <span class="hidden sm:inline text-slate-300">|</span>
                <div class="flex items-center gap-1">
                  <input type="text" id="horario-desde2-${d.id}" value="${datosDia.desde2 || '17:00'}" placeholder="17:00" class="clean-input horario-inputs-${d.id} px-2 py-1 rounded-lg text-xs font-semibold w-16 text-center ${datosDia.cerrado ? 'opacity-40 bg-slate-100' : ''}" ${datosDia.cerrado ? 'disabled' : ''}>
                  <span class="text-slate-400 text-xs">a</span>
                  <input type="text" id="horario-hasta2-${d.id}" value="${datosDia.hasta2 || '21:00'}" placeholder="21:00" class="clean-input horario-inputs-${d.id} px-2 py-1 rounded-lg text-xs font-semibold w-16 text-center ${datosDia.cerrado ? 'opacity-40 bg-slate-100' : ''}" ${datosDia.cerrado ? 'disabled' : ''}>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      });
    }

    function obtenerHorariosFormulario() {
      let obj = {};
      const tipo = document.getElementById('modal-tipo-horario')?.value || 'corrido';
      DIAS_SEMANA.forEach(d => {
        const cerrado = document.getElementById(`chk-cerrado-${d.id}`).checked;
        const desde = document.getElementById(`horario-desde-${d.id}`).value.trim();
        const hasta = document.getElementById(`horario-hasta-${d.id}`).value.trim();
        let desde2 = '', hasta2 = '';
        if (tipo === 'cortado') {
          const elD2 = document.getElementById(`horario-desde2-${d.id}`);
          const elH2 = document.getElementById(`horario-hasta2-${d.id}`);
          if (elD2) desde2 = elD2.value.trim();
          if (elH2) hasta2 = elH2.value.trim();
        }
        obj[d.id] = { cerrado, desde, hasta, desde2, hasta2, tipo };
      });
      return obj;
    }

    function estaAbiertoSegunGrilla(horariosGrilla) {
      if (!horariosGrilla) return false;
      const ahora = new Date();
      const diasMap = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
      const diaHoy = diasMap[ahora.getDay()];
      
      const configHoy = horariosGrilla[diaHoy];
      if (!configHoy || configHoy.cerrado) return false;

      let abiertoTurno1 = estaEnRango(configHoy.desde, configHoy.hasta);
      let abiertoTurno2 = (configHoy.desde2 && configHoy.hasta2) ? estaEnRango(configHoy.desde2, configHoy.hasta2) : false;

      return abiertoTurno1 || abiertoTurno2;
    }

    function estaEnRango(hApertura, hCierre) {
      if (!hApertura || !hCierre) return false;
      const ahora = new Date();
      const actualMin = ahora.getHours() * 60 + ahora.getMinutes();
      const partesA = hApertura.trim().split(':');
      const partesC = hCierre.trim().split(':');
      if (partesA.length < 2 || partesC.length < 2) return false;
      const apMin = parseInt(partesA[0], 10) * 60 + parseInt(partesA[1], 10);
      const ciMin = parseInt(partesC[0], 10) * 60 + parseInt(partesC[1], 10);
      if (isNaN(apMin) || isNaN(ciMin)) return false;

      return apMin <= ciMin 
        ? (actualMin >= apMin && actualMin <= ciMin) 
        : (actualMin >= apMin || actualMin <= ciMin);
    }

    // ¿El comercio pausó su local por hoy? (se vence solo a la medianoche)
    function estaPausado(c) {
      return Boolean(c && c.pausado_hasta && new Date(c.pausado_hasta).getTime() > Date.now());
    }

    function estaAbierto(c) {
      if (estaPausado(c)) return false;
      if (c.horarios_dias) {
        return estaAbiertoSegunGrilla(c.horarios_dias);
      }
      return estaEnRango(c.hora_apertura, c.hora_cierre);
    }

    function obtenerHorarioHoyTexto(c) {
      if (!c.horarios_dias) return "Consultar horario";
      const ahora = new Date();
      const diasMap = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
      const diaHoy = diasMap[ahora.getDay()];
      const config = c.horarios_dias[diaHoy];

      if (!config || config.cerrado) return "Cerrado hoy";
      if (config.desde2 && config.hasta2) {
        return `${config.desde} a ${config.hasta} hs y ${config.desde2} a ${config.hasta2} hs`;
      }
      return `${config.desde} a ${config.hasta} hs`;
    }
