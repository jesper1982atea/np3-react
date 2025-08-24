const VAPID_PUBLIC = '<DIN_VAPID_PUBLIC_KEY_BASE64URL>'

export async function askPushPermissionAndSubscribe() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push saknas i denna webbläsare')
  }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notiser nekades')

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
  })
  // skicka sub till din server
  await fetch('/api/save-subscription', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(sub)
  })
  return sub
}

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i=0;i<raw.length;i++) arr[i] = raw.charCodeAt(i)
  return arr
}