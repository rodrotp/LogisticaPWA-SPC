function buildBackupFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `Backup_Logistica_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.json`;
}

async function generateDatabaseSnapshotJSON() {
  const tables = ['vehiculos', 'materiales', 'almacenes', 'eventos', 'usuarios', 'checklists', 'historico_transferencias'];
  const snapshot = {};
  for (const tableName of tables) {
    snapshot[tableName] = await window.appDB[tableName].toArray();
  }
  return JSON.stringify(snapshot, null, 2);
}

async function descargarBackupLocal() {
  try {
    const jsonData = await generateDatabaseSnapshotJSON();
    const filename = buildBackupFilename();
    const blob = new Blob([jsonData], { type: 'application/json' });

    const downloadUrl = URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.href = downloadUrl;
    tempLink.download = filename;
    document.body.appendChild(tempLink);
    tempLink.click();
    setTimeout(() => {
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(downloadUrl);
    }, 100);

  } catch (error) {
    console.error(error);
    alert('Fallo en la exportación: ' + error.message);
  }
}

async function compartirBackupLocal() {
  try {
    const jsonData = await generateDatabaseSnapshotJSON();
    const filename = buildBackupFilename();
    const blob = new Blob([jsonData], { type: 'text/plain' });
    const fileObj = new File([blob], filename, { type: 'text/plain' });

    if (navigator.canShare && navigator.canShare({ files: [fileObj] })) {
      await navigator.share({
        title: 'Copia de Seguridad Logística',
        text: 'Backup de base de datos.',
        files: [fileObj]
      });
    } else {
      alert('La función de compartir no está soportada. Usa "Descargar".');
    }
  } catch (error) {
    console.error(error);
    alert('No se pudo compartir. Usa la opción "Descargar".');
  }
}

async function cargarBackupManual() {
  // 1. Capturamos el input y verificamos que haya un archivo seleccionado
  const fileInput = document.getElementById('import-file-control');
  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Por favor, selecciona un archivo .json primero usando el botón superior.');
    return;
  }

  // 2. Pedimos confirmación al usuario por seguridad
  if (!confirm('¿Estás seguro de querer restaurar esta copia? Esto borrará y sobreescribirá todos los datos actuales de tu dispositivo.')) {
    return;
  }

  const file = fileInput.files[0];

  // 3. Ejecutamos la lectura y volcado en IndexedDB
  try {
    const fileContent = await file.text();
    const parsedData = JSON.parse(fileContent);
    const tablesToReset = ['vehiculos', 'materiales', 'almacenes', 'eventos', 'usuarios', 'checklists', 'historico_transferencias'];

    await window.appDB.transaction('rw', tablesToReset, async () => {
      for (const table of tablesToReset) {
        if (parsedData[table]) {
          await window.appDB[table].clear();
          await window.appDB[table].bulkAdd(parsedData[table]);
        }
      }
    });

    alert('Base de datos restaurada con éxito.');
    window.location.reload(); // Recarga la app para aplicar los datos visualmente
  } catch (error) {
    console.error(error);
    alert('Fallo al restaurar: Archivo inválido o corrupto.');
  }
}

const msalConfig = {
  auth: { clientId: "00000000-0000-0000-0000-000000000000", authority: "https://login.microsoftonline.com/common", redirectUri: window.location.href.split('#')[0] }
};
let msalInstance = null;
if (typeof msal !== 'undefined') msalInstance = new msal.PublicClientApplication(msalConfig);

async function ejecutarCopiaOneDrive() {
  if (!msalInstance) { alert('MSAL no cargado.'); return; }
  try {
    const authResult = await msalInstance.loginPopup({ scopes: ["files.readwrite", "User.Read"] });
    const jsonData = await generateDatabaseSnapshotJSON();
    const filename = buildBackupFilename();
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/LogisticaApp_Backups/${filename}:/content`;
    const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Authorization': `Bearer ${authResult.accessToken}`, 'Content-Type': 'application/json' }, body: jsonData });
    if (response.ok) alert(`Copia en OneDrive completada.`);
    else throw new Error('Error en API Graph');
  } catch (error) {
    alert('Fallo con OneDrive: ' + error.message);
  }
}
