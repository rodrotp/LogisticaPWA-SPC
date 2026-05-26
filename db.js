const db = new Dexie('LogisticaDB');

db.version(1).stores({
  vehiculos: '++id, numero_municipal, matricula',
  materiales: '++id, codigo, ubicacion_tipo, ubicacion_id', 
  almacenes: '++id, nombre',
  eventos: '++id, nombre, fecha',
  usuarios: '++id, pin, nombre',
  checklists: '++id, vehiculo_id, fecha, usuario_pin',
  historico_transferencias: '++id, fecha, usuario_pin'
});

function compressImage(file, maxWidth = 600) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) { resolve(''); return; }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width; let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

async function verificarYAlimentarSemilla() {
  const countUsuarios = await db.usuarios.count();
  if (countUsuarios === 0) {
    await db.usuarios.add({ nombre: "Operario Principal", pin: "1234" });
    await db.usuarios.add({ nombre: "Supervisor Centro", pin: "9999" });

    const idAlm1 = await db.almacenes.add({ nombre: "Almacén Central Norte", descripcion: "Hangar Principal" });
    const idAlm2 = await db.almacenes.add({ nombre: "Depósito Auxiliar Sur", descripcion: "Módulo Logístico" });

    const idVeh1 = await db.vehiculos.add({ numero_municipal: "V-102", matricula: "1234-BBB", peso_max: 3500, medidas: "6m x 2.2m", foto_vehiculo: "", foto_esquema: "" });

    await db.materiales.bulkAdd([
      { codigo: "MAT-001", descripcion: "Vallas Perimetrales", peso: 15, tamano: "2x1m", cantidad: 120, ubicacion_tipo: "almacen", ubicacion_id: idAlm1, foto_material: "" },
      { codigo: "MAT-002", descripcion: "Grupo Electrógeno", peso: 85, tamano: "1x0.8m", cantidad: 3, ubicacion_tipo: "almacen", ubicacion_id: idAlm1, foto_material: "" }
    ]);

    await db.eventos.add({ nombre: "Montaje Plaza", lat: 40.4167, lng: -3.7037, fecha: "2026-07-15", hora: "08:00", notas: "Coordinar descarga perimetral." });
  }
}

window.appDB = db;
db.open().then(() => verificarYAlimentarSemilla()).catch(err => console.error("Fallo abriendo IndexedDB:", err));
