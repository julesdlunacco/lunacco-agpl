/**
 * useProfile — convenience hook over UserContext for profile data.
 *
 * Provides:
 *   profileData — { preferred_tone, astrology, human_design, numerology }
 *   setProfileData — local state setter
 *   saveProfile(data) — persists to server via UserContext
 *   profileSaving, profileSavedMsg
 */
import { useUser } from '../contexts/UserContext.jsx';

export function useProfile() {
  const { profileData, setProfileData, saveProfile, profileSaving, profileSavedMsg } = useUser();
  return { profileData, setProfileData, saveProfile, profileSaving, profileSavedMsg };
}
