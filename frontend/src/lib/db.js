const KEY = 'fyp_profile'

export function saveProfile(profile) {
  localStorage.setItem(KEY, JSON.stringify(profile))
}

export function loadProfile() {
  const raw = localStorage.getItem(KEY)
  return raw ? JSON.parse(raw) : null
}

export function clearProfile() {
  localStorage.removeItem(KEY)
}
