import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as Location from 'expo-location';
import { apiClient } from '../api/client';
import { calculateDistanceKm } from '../utils/haversine';

export interface Branch {
  id: number;
  name: string;
  slug: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  opening_hours: Record<string, { open: string; close: string }>;
  is_open: boolean;
  is_active: boolean;
  tax_rate: number;
  distanceKm?: number;
}

interface BranchContextType {
  branches: Branch[];
  selectedBranch: Branch | null;
  isLoading: boolean;
  userCoords: { latitude: number; longitude: number } | null;
  locationPermissionDenied: boolean;
  selectBranch: (branch: Branch) => void;
  selectBranchBySlug: (slug: string) => Promise<boolean>;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState<boolean>(false);

  const fetchBranches = async (coords?: { latitude: number; longitude: number }) => {
    setIsLoading(true);
    try {
      const res = await apiClient.post('/branches', { activeOnly: true });
      let list: Branch[] = res.data.data;

      const currentCoords = coords || userCoords;

      if (currentCoords) {
        list = list.map((b) => ({
          ...b,
          distanceKm: calculateDistanceKm(
            currentCoords.latitude,
            currentCoords.longitude,
            b.latitude,
            b.longitude
          ),
        }));

        // Ordenar por distancia ascendente
        list.sort((a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999));
      }

      setBranches(list);

      // Si no hay sucursal seleccionada previa o si la seleccionada ya no existe en la lista de sucursales activas,
      // auto-seleccionar la primera (la más cercana o predeterminada) para evitar errores 404
      setSelectedBranch((prev) => {
        if (!prev) return list.length > 0 ? list[0] : null;
        const exists = list.find((b) => b.id === prev.id);
        if (exists) {
          return exists;
        }
        return list.length > 0 ? list[0] : null;
      });
    } catch (err) {
      console.error('[BranchContext] Error al cargar sucursales:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    async function initLocationAndBranches() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationPermissionDenied(true);
          await fetchBranches();
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserCoords(coords);
        await fetchBranches(coords);
      } catch (err) {
        console.warn('[BranchContext] No se pudo obtener geolocalización:', err);
        setLocationPermissionDenied(true);
        await fetchBranches();
      }
    }

    initLocationAndBranches();
  }, []);

  const selectBranch = (branch: Branch) => {
    setSelectedBranch(branch);
  };

  const selectBranchBySlug = async (slug: string): Promise<boolean> => {
    const found = branches.find((b) => b.slug.toLowerCase() === slug.toLowerCase().trim());
    if (found) {
      setSelectedBranch(found);
      return true;
    }

    // Si no esta en la lista en memoria, consultar a la API
    try {
      const res = await apiClient.post(`/branches/${slug.trim()}`);
      if (res.data?.branch) {
        const branch = res.data.branch;
        setSelectedBranch(branch);
        return true;
      }
    } catch {
      // No encontrada
    }
    return false;
  };

  const refreshBranches = async () => {
    await fetchBranches();
  };

  return (
    <BranchContext.Provider
      value={{
        branches,
        selectedBranch,
        isLoading,
        userCoords,
        locationPermissionDenied,
        selectBranch,
        selectBranchBySlug,
        refreshBranches,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch debe ser utilizado dentro de un BranchProvider');
  }
  return context;
}
