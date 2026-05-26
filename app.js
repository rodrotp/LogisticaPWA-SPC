let currentActiveSubTab = 'materiales';
let mapInstance = null;
let mapMarkers = [];
let selectedMaterialRowId = null;

document.addEventListener('DOMContentLoaded', () => {
  renderizarPestañaActivaInventario();
  actualizarSelectoresUbicacionOps();
});

function switchMainView(viewName, element) {
  document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');
  element.classList.add('active');
  if (viewName === 'mapa') setTimeout(() => { inicializarMapaLeaflet(); }, 100);
  else if (viewName === 'operaciones') actualizarSelectoresUbicacionOps();
}

// NUEVO: Manejo adaptativo de inputs de filtrado según la pestaña activa
function switchSubTab(subTabName) {
  currentActiveSubTab = subTabName;
  document.querySelectorAll('.sub-tabs .tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.innerText.toLowerCase().includes(subTabName.substring(0,3))) btn.classList.add('active');
  });

  const txtBuscar = document.getElementById('txt-filtro-buscar');
  const txtFecha = document.getElementById('txt-filtro-fecha');

  // Limpiar filtros al conmutar pestañas
  txtBuscar.value = '';
  txtFecha.value = '';

  if (subTabName === 'eventos') {
    txtBuscar.placeholder = "Filtrar eventos por nombre...";
    txtFecha.style.display = 'block';
  } else if (subTabName === 'materiales') {
    txtBuscar.placeholder = "Filtrar material por nombre o ubicación...";
    txtFecha.style.display = 'none';
  } else {
    txtBuscar.placeholder = "Buscar...";
    txtFecha.style.display = 'none';
  }

  renderizarPestañaActivaInventario();
}

// ==========================================
// CRUD: LECTURA Y FILTRADO AVANZADO REQUERIDO
// ==========================================
async function renderizarPestañaActivaInventario() {
  const container = document.getElementById('inventario-contenido');
  container.innerHTML = '<p>Filtrando catálogo...</p>';

  const queryTexto = document.getElementById('txt-filtro-buscar').value.toLowerCase().trim();
  const queryFecha = document.getElementById('txt-filtro-fecha').value;

  try {
    if (currentActiveSubTab === 'materiales') {
      const datos = await window.appDB.materiales.toArray();
      let html = '';
      let contadorItems = 0;

      for (const m of datos) {
        let ubicacionTexto = 'No asignado';
        if (m.ubicacion_tipo === 'almacen') {
          const alm = await window.appDB.almacenes.get(Number(m.ubicacion_id));
          ubicacionTexto = alm ? `Almacén: ${alm.nombre}` : ubicacionTexto;
        } else if (m.ubicacion_tipo === 'vehiculo') {
          const veh = await window.appDB.vehiculos.get(Number(m.ubicacion_id));
          ubicacionTexto = veh ? `Vehículo: ${veh.numero_municipal}` : ubicacionTexto;
        }

        // NUEVO: Regla de filtrado cruzado por Nombre (Descripción) o Ubicación física
        const cumpleNombre = m.descripcion.toLowerCase().includes(queryTexto) || m.codigo.toLowerCase().includes(queryTexto);
        const cumpleUbicacion = ubicacionTexto.toLowerCase().includes(queryTexto);

        if (queryTexto !== '' && !cumpleNombre && !cumpleUbicacion) {
          continue; 
        }

        contadorItems++;
        html += `
          <div class="card">
            <div class="card-header">
              <span><strong>[${m.codigo}]</strong> ${m.descripcion}</span>
              <span style="font-size:12px; background:var(--bg-muted); padding:2px 6px; border-radius:4px;">Cant: ${m.cantidad}</span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary)">
              <p><i class="fa-solid fa-weight-hanging"></i> Peso: ${m.peso} kg | Tamaño: ${m.tamano}</p>
              <p style="margin-top:4px;"><i class="fa-solid fa-location-dot"></i> <strong>${ubicacionTexto}</strong></p>
            </div>
            ${m.foto_material ? `<div class="img-preview-container"><img src="${m.foto_material}" class="thumb-preview"></div>` : ''}
            <div class="action-bar">
              <button class="btn btn-secondary" onclick="abrirModalEdicion('materiales', ${m.id})"><i class="fa-solid fa-pen"></i> Editar</button>
              <button class="btn btn-danger" onclick="borrarActivo('materiales', ${m.id})"><i class="fa-solid fa-trash"></i> Borrar</button>
            </div>
          </div>`;
      }
      container.innerHTML = contadorItems === 0 ? '<p class="card">Ningún material coincide con el filtro.</p>' : html;

    } else if (currentActiveSubTab === 'vehiculos') {
      const datos = await window.appDB.vehiculos.toArray();
      let html = '';
      let filtered = datos.filter(v => v.numero_municipal.toLowerCase().includes(queryTexto) || v.matricula.toLowerCase().includes(queryTexto));
      
      if (filtered.length === 0) { container.innerHTML = '<p class="card">No existen vehículos coincidentes.</p>'; return; }
      
      filtered.forEach(v => {
        html += `
          <div class="card">
            <div class="card-header">
              <span><i class="fa-solid fa-truck"></i> <strong>${v.numero_municipal}</strong></span>
              <span style="font-size:11px;">Matrícula: ${v.matricula}</span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary)">
              <p>Carga Máxima: <strong>${v.peso_max} kg</strong></p>
              <p>Dimensiones: ${v.medidas}</p>
            </div>
            <div class="action-bar">
              <button class="btn btn-secondary" onclick="abrirModalEdicion('vehiculos', ${v.id})"><i class="fa-solid fa-pen"></i> Editar</button>
              <button class="btn btn-danger" onclick="borrarActivo('vehiculos', ${v.id})"><i class="fa-solid fa-trash"></i> Borrar</button>
            </div>
          </div>`;
      });
      container.innerHTML = html;

    } else if (currentActiveSubTab === 'almacenes') {
      const datos = await window.appDB.almacenes.toArray();
      let html = '';
      let filtered = datos.filter(a => a.nombre.toLowerCase().includes(queryTexto));
      if (filtered.length === 0) { container.innerHTML = '<p class="card">No existen almacenes coincidentes.</p>'; return; }
      
      filtered.forEach(a => {
        html += `
          <div class="card">
            <div style="font-weight:600; font-size:14px; margin-bottom:4px;">${a.nombre}</div>
            <div style="font-size:12px; color:var(--text-secondary)">${a.descripcion || 'Sin descripción física.'}</div>
            <div class="action-bar">
              <button class="btn btn-secondary" onclick="abrirModalEdicion('almacenes', ${a.id})"><i class="fa-solid fa-pen"></i> Editar</button>
              <button class="btn btn-danger" onclick="borrarActivo('almacenes', ${a.id})"><i class="fa-solid fa-trash"></i> Borrar</button>
            </div>
          </div>`;
      });
      container.innerHTML = html;

    } else if (currentActiveSubTab === 'eventos') {
      const datos = await window.appDB.eventos.toArray();
      let html = '';
      
      // NUEVO: Regla de filtrado para eventos por Nombre Y/O por Fecha cronológica exacta
      let filtered = datos.filter(e => {
        const cumpleTxt = e.nombre.toLowerCase().includes(queryTexto);
        const cumpleFec = queryFecha === '' ? true : (e.fecha === queryFecha);
        return cumpleTxt && cumpleFec;
      });

      if (filtered.length === 0) { container.innerHTML = '<p class="card">Ningún evento cumple los filtros fijados.</p>'; return; }
      
      filtered.forEach(e => {
        html += `
          <div class="card">
            <div class="card-header">
              <span><i class="fa-solid fa-calendar-day"></i> <strong>${e.nombre}</strong></span>
              <span style="font-size:12px; background:var(--bg-muted); padding:2px 6px; border-radius:4px;">${e.fecha}</span>
            </div>
            <div style="font-size:12px; color:var(--text-secondary)">
              <p>Cita: <strong>${e.hora}</strong></p>
              <p>Coordenadas: <em>${e.lat}, ${e.lng}</em></p>
              <p style="margin-top:4px;">Notas: ${e.notas || 'Sin anotaciones.'}</p>
            </div>
            <div class="action-bar">
              <button class="btn btn-secondary" onclick="abrirModalEdicion('eventos', ${e.id})"><i class="fa-solid fa-pen"></i> Editar</button>
              <button class="btn btn-danger" onclick="borrarActivo('eventos', ${e.id})"><i class="fa-solid fa-trash"></i> Borrar</button>
            </div>
          </div>`;
      });
      container.innerHTML = html;
    }
  } catch (error) {
    container.innerHTML = '<p class="card">Fallo al filtrar los datos.</p>';
  }
}

// ==========================================
// CRUD: CAMPOS DINÁMICOS FORMULARIO
// ==========================================
function generarCamposFormulario(coleccion, item = null) {
  let html = '';
  if (coleccion === 'materiales') {
    html = `
      <div class="form-group"><label>Código</label><input type="text" id="frm-mat-cod" class="form-control" required value="${item?.codigo || ''}"></div>
      <div class="form-group"><label>Descripción</label><input type="text" id="frm-mat-desc" class="form-control" required value="${item?.descripcion || ''}"></div>
      <div class="form-group"><label>Peso (kg)</label><input type="number" id="frm-mat-peso" class="form-control" value="${item?.peso || 1}"></div>
      <div class="form-group"><label>Tamaño</label><input type="text" id="frm-mat-tam" class="form-control" value="${item?.tamano || ''}"></div>
      <div class="form-group"><label>Cantidad</label><input type="number" id="frm-mat-cant" class="form-control" value="${item?.cantidad || 1}"></div>
      <div class="form-group"><label>Ubicación</label><select id="frm-mat-ub" class="form-control"></select></div>
      <div class="form-group"><label>Foto (Opcional)</label><input type="file" id="frm-mat-foto" class="form-control" accept="image/*"></div>`;
  } else if (coleccion === 'vehiculos') {
    html = `
      <div class="form-group"><label>Num. Municipal</label><input type="text" id="frm-veh-num" class="form-control" required value="${item?.numero_municipal || ''}"></div>
      <div class="form-group"><label>Matrícula</label><input type="text" id="frm-veh-mat" class="form-control" required value="${item?.matricula || ''}"></div>
      <div class="form-group"><label>Carga Max (kg)</label><input type="number" id="frm-veh-max" class="form-control" value="${item?.peso_max || 3500}"></div>
      <div class="form-group"><label>Medidas Caja</label><input type="text" id="frm-veh-med" class="form-control" value="${item?.medidas || ''}"></div>`;
  } else if (coleccion === 'almacenes') {
    html = `
      <div class="form-group"><label>Nombre del Almacén</label><input type="text" id="frm-alm-nom" class="form-control" required value="${item?.nombre || ''}"></div>
      <div class="form-group"><label>Ubicación Física/Notas</label><input type="text" id="frm-alm-desc" class="form-control" value="${item?.descripcion || ''}"></div>`;
  } else if (coleccion === 'eventos') {
    html = `
      <div class="form-group"><label>Nombre del Evento (Corto)</label><input type="text" id="frm-ev-nom" class="form-control" required value="${item?.nombre || ''}" maxlength="25"></div>
      <div class="form-group"><label>Fecha de Ejecución</label><input type="date" id="frm-ev-fec" class="form-control" required value="${item?.fecha || ''}"></div>
      <div class="form-group"><label>Hora de Cita</label><input type="time" id="frm-ev-hor" class="form-control" required value="${item?.hora || ''}"></div>
      <div class="form-group"><label>Latitud WGS84</label><input type="number" step="any" id="frm-ev-lat" class="form-control" required value="${item?.lat || ''}"></div>
      <div class="form-group"><label>Longitud WGS84</label><input type="number" step="any" id="frm-ev-lng" class="form-control" required value="${item?.lng || ''}"></div>
      <div class="form-group"><label>Notas Técnicas Operativas</label><input type="text" id="frm-ev-not" class="form-control" value="${item?.notas || ''}"></div>`;
  }
  return html;
}

function abrirModalAlta() {
  document.getElementById('form-modo').value = 'alta';
  document.getElementById('formulario-modal-titulo').innerText = `Nuevo Registro`;
  document.getElementById('form-dinamico-fields').innerHTML = generarCamposFormulario(currentActiveSubTab);
  if (currentActiveSubTab === 'materiales') cargarUbicacionesFormularioAlta('frm-mat-ub');
  document.getElementById('modal-formulario').style.display = 'flex';
}

async function abrirModalEdicion(coleccion, id) {
  try {
    const item = await window.appDB[coleccion].get(id);
    document.getElementById('form-modo').value = 'editar';
    document.getElementById('form-id').value = id;
    document.getElementById('formulario-modal-titulo').innerText = `Editar Registro`;
    document.getElementById('form-dinamico-fields').innerHTML = generarCamposFormulario(coleccion, item);
    if (coleccion === 'materiales') {
      const ubiActual = `${item.ubicacion_tipo}-${item.ubicacion_id}`;
      cargarUbicacionesFormularioAlta('frm-mat-ub', ubiActual);
    }
    document.getElementById('modal-formulario').style.display = 'flex';
  } catch (e) {
    alert('Error cargando los datos.');
  }
}

async function guardarActivo(event) {
  event.preventDefault();
  const modo = document.getElementById('form-modo').value;
  const id = Number(document.getElementById('form-id').value);

  try {
    let payload = {};
    
    if (currentActiveSubTab === 'materiales') {
      const ubiVal = document.getElementById('frm-mat-ub').value;
      const [tipoUbi, idUbi] = ubiVal ? ubiVal.split('-') : ['almacen', 0];
      payload = {
        codigo: document.getElementById('frm-mat-cod').value,
        descripcion: document.getElementById('frm-mat-desc').value,
        peso: Number(document.getElementById('frm-mat-peso').value),
        tamano: document.getElementById('frm-mat-tam').value,
        cantidad: Number(document.getElementById('frm-mat-cant').value),
        ubicacion_tipo: tipoUbi,
        ubicacion_id: Number(idUbi)
      };
      const fileInput = document.getElementById('frm-mat-foto');
      if (fileInput && fileInput.files.length > 0) {
        payload.foto_material = await compressImage(fileInput.files[0], 600);
      }
    } else if (currentActiveSubTab === 'vehiculos') {
      payload = {
        numero_municipal: document.getElementById('frm-veh-num').value,
        matricula: document.getElementById('frm-veh-mat').value,
        peso_max: Number(document.getElementById('frm-veh-max').value),
        medidas: document.getElementById('frm-veh-med').value
      };
    } else if (currentActiveSubTab === 'almacenes') {
      payload = {
        nombre: document.getElementById('frm-alm-nom').value,
        descripcion: document.getElementById('frm-alm-desc').value
      };
    } else if (currentActiveSubTab === 'eventos') {
      payload = {
        nombre: document.getElementById('frm-ev-nom').value,
        fecha: document.getElementById('frm-ev-fec').value,
        hora: document.getElementById('frm-ev-hor').value,
        lat: parseFloat(document.getElementById('frm-ev-lat').value),
        lng: parseFloat(document.getElementById('frm-ev-lng').value),
        notas: document.getElementById('frm-ev-not').value
      };
    }

    if (modo === 'alta') {
      await window.appDB[currentActiveSubTab].add(payload);
    } else {
      await window.appDB[currentActiveSubTab].update(id, payload);
    }

    cerrarModal('modal-formulario');
    renderizarPestañaActivaInventario();
    actualizarSelectoresUbicacionOps();
    if (mapInstance) cargarPinesDeEventosEnMapa();
  } catch (error) {
    alert('Error al guardar: ' + error.message);
  }
}

async function borrarActivo(coleccion, id) {
  if(confirm('¿Eliminar de forma permanente este elemento de la base de datos?')) {
    try {
      await window.appDB[coleccion].delete(id);
      renderizarPestañaActivaInventario();
      actualizarSelectoresUbicacionOps();
      if (mapInstance) cargarPinesDeEventosEnMapa();
    } catch (e) {
      alert('Error al borrar: ' + e.message);
    }
  }
}

// ==========================================
// MOTOR CARTOGRÁFICO: LEAFLET + CLICK TO CREATE
// ==========================================
function inicializarMapaLeaflet() {
  if (mapInstance) return;
  mapInstance = L.map('map').setView([40.416775, -3.703790], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);

  // NUEVO: Escuchador de clics táctiles/ratón sobre el lienzo del mapa para crear eventos in-situ
  mapInstance.on('click', function(e) {
    const latitudClic = e.latlng.lat.toFixed(6);
    const longitudClic = e.latlng.lng.toFixed(6);

    // 1. Conmutar a la pestaña interna de eventos
    switchSubTab('eventos');
    
    // 2. Levantar el modal de registro estructurado
    document.getElementById('form-modo').value = 'alta';
    document.getElementById('formulario-modal-titulo').innerText = `Nuevo Evento desde Mapa`;
    document.getElementById('form-dinamico-fields').innerHTML = generarCamposFormulario('eventos');

    // 3. Pre-rellenar las coordenadas exactas de la pulsación
    document.getElementById('frm-ev-lat').value = latitudClic;
    document.getElementById('frm-ev-lng').value = longitudClic;

    // 4. Mostrar el modal en pantalla
    document.getElementById('modal-formulario').style.display = 'flex';
  });

  cargarPinesDeEventosEnMapa();
}

async function cargarPinesDeEventosEnMapa() {
  if (!mapInstance) return;
  mapMarkers.forEach(m => mapInstance.removeLayer(m));
  mapMarkers = [];
  const eventos = await window.appDB.eventos.toArray();
  const listaContenedor = document.getElementById('lista-eventos-mapa');
  if (listaContenedor) listaContenedor.innerHTML = '';

  eventos.forEach(ev => {
    if (ev.lat && ev.lng) {
      const m = L.marker([ev.lat, ev.lng]).addTo(mapInstance);
      m.bindPopup(`<strong>${ev.nombre}</strong><br>Fecha: ${ev.fecha}<br>Hora: ${ev.hora}<br><em>${ev.notas || ''}</em>`);
      
      m.bindTooltip(ev.nombre, {
        permanent: true,
        direction: 'bottom',
        className: 'custom-pin-label',
        offset: [0, 10]
      });

      mapMarkers.push(m);
    }
    
    if (listaContenedor) {
      listaContenedor.innerHTML += `
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:600;"><i class="fa-solid fa-location-dot"></i> ${ev.nombre}</div>
            <span style="font-size:11px; color:var(--text-secondary)">${ev.fecha}</span>
          </div>
          <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">
            Coordenadas: ${ev.lat}, ${ev.lng}
          </div>
        </div>`;
    }
  });
}

// ==========================================
// TRASPASOS INTERNOS
// ==========================================
async function cargarUbicacionesFormularioAlta(elementId, valorPreseleccionado = null) {
  const select = document.getElementById(elementId);
  if (!select) return;
  select.innerHTML = '';
  const almacenes = await window.appDB.almacenes.toArray();
  const vehiculos = await window.appDB.vehiculos.toArray();
  almacenes.forEach(a => { select.innerHTML += `<option value="almacen-${a.id}">Almacén: ${a.nombre}</option>`; });
  vehiculos.forEach(v => { select.innerHTML += `<option value="vehiculo-${v.id}">Vehículo: ${v.numero_municipal}</option>`; });
  if (valorPreseleccionado) select.value = valorPreseleccionado;
}

async function actualizarSelectoresUbicacionOps() {
  const selOrigen = document.getElementById('op-origen');
  const selDestino = document.getElementById('op-destino');
  if (!selOrigen || !selDestino) return;
  selOrigen.innerHTML = ''; selDestino.innerHTML = '';
  const almacenes = await window.appDB.almacenes.toArray();
  const vehiculos = await window.appDB.vehiculos.toArray();
  let optionsHtml = '';
  almacenes.forEach(a => { optionsHtml += `<option value="almacen-${a.id}">Almacén: ${a.nombre}</option>`; });
  vehiculos.forEach(v => { optionsHtml += `<option value="vehiculo-${v.id}">Vehículo: ${v.numero_municipal}</option>`; });
  selOrigen.innerHTML = optionsHtml; selDestino.innerHTML = optionsHtml;
  if (selDestino.options.length > 1) selDestino.selectedIndex = 1;
  actualizarPanelesTransferencia();
}

async function actualizarPanelesTransferencia() {
  const panelOrigen = document.getElementById('panel-origen-materiales');
  const valOrigen = document.getElementById('op-origen').value;
  if (!panelOrigen || !valOrigen) return;
  panelOrigen.innerHTML = ''; selectedMaterialRowId = null;
  const [tipo, id] = valOrigen.split('-');
  const materialesVisibles = await window.appDB.materiales.where('ubicacion_tipo').equals(tipo).and(item => item.ubicacion_id == id).toArray();
  if (materialesVisibles.length === 0) { panelOrigen.innerHTML = '<p style="font-size:12px; padding:6px; color:var(--text-secondary)">No hay materiales aquí.</p>'; return; }
  materialesVisibles.forEach(mat => {
    panelOrigen.innerHTML += `<div class="list-item-touch" id="mat-row-${mat.id}" onclick="seleccionarMaterialParaMover(${mat.id})"><span>[${mat.codigo}] ${mat.descripcion}</span><span>Disp: ${mat.cantidad}</span></div>`;
  });
}

function seleccionarMaterialParaMover(id) {
  document.querySelectorAll('.list-item-touch').forEach(el => el.classList.remove('selected'));
  selectedMaterialRowId = id;
  document.getElementById(`mat-row-${id}`).classList.add('selected');
}

function procesarMovimientoMaterial() {
  if (!selectedMaterialRowId) { alert('Selecciona un material de origen.'); return; }
  if (document.getElementById('op-origen').value === document.getElementById('op-destino').value) { alert('Origen y destino deben ser distintos.'); return; }
  document.getElementById('txt-cant-mover').value = 1;
  document.getElementById('txt-pin-firma').value = '';
  document.getElementById('modal-cantidad-transferencia').style.display = 'flex';
}

async function confirmarYEjecutarTransferenciaObjeto() {
  const cantidadAMover = Number(document.getElementById('txt-cant-mover').value);
  const pinIntroducido = document.getElementById('txt-pin-firma').value;
  if (!cantidadAMover || cantidadAMover <= 0) { alert('Cantidad inválida.'); return; }
  if (!pinIntroducido) { alert('Introduce tu PIN de firma.'); return; }

  const operarioValido = await window.appDB.usuarios.where('pin').equals(pinIntroducido).first();
  if (!operarioValido) { alert('PIN incorrecto.'); return; }

  try {
    const materialOrigen = await window.appDB.materiales.get(selectedMaterialRowId);
    if (!materialOrigen || materialOrigen.cantidad < cantidadAMover) { alert('Stock insuficiente en origen.'); return; }
    const [destTipo, destId] = document.getElementById('op-destino').value.split('-');

    await window.appDB.transaction('rw', [window.appDB.materiales, window.appDB.historico_transferencias], async () => {
      const nuevaCantidadOrigen = materialOrigen.cantidad - cantidadAMover;
      if (nuevaCantidadOrigen === 0) await window.appDB.materiales.update(materialOrigen.id, { cantidad: 0 });
      else await window.appDB.materiales.update(materialOrigen.id, { cantidad: nuevaCantidadOrigen });

      const materialExistenteDestino = await window.appDB.materiales.where('codigo').equals(materialOrigen.codigo).and(item => item.ubicacion_tipo === destTipo && item.ubicacion_id == destId).first();
      
      if (materialExistenteDestino) {
        await window.appDB.materiales.update(materialExistenteDestino.id, { cantidad: materialExistenteDestino.cantidad + cantidadAMover });
      } else {
        await window.appDB.materiales.add({ ...materialOrigen, id: undefined, cantidad: cantidadAMover, ubicacion_tipo: destTipo, ubicacion_id: Number(destId) });
      }
      await window.appDB.historico_transferencias.add({ fecha: new Date().toISOString(), usuario_pin: pinIntroducido, detalle: `Traspaso interno` });
    });

    cerrarModal('modal-cantidad-transferencia');
    actualizarPanelesTransferencia();
    renderizarPestañaActivaInventario();
    alert('Traspaso completado.');
  } catch (error) { alert('Fallo en traspaso: ' + error.message); }
}

function cerrarModal(id) { document.getElementById(id).style.display = 'none'; }
