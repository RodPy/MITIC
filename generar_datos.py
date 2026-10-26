"""
Genera prototipo/data.js con las sedes reales para el prototipo de Laboratorios TIC.

Fuente: hoja «Escuelas» de tipologias_steam_800_escuelas.xlsx.
- Las escuelas con Seleccionado = SI son las 200 sedes con laboratorio.
- 40 de ellas forman la fase inicial (la de mayor matrícula de media de cada
  departamento y luego el resto por matrícula). Las otras 160 quedan en expansión.
- Coordenadas aproximadas: centroide del departamento con un desplazamiento fijo
  por código de establecimiento (no hay georreferencia real en la planilla).
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
ARCHIVO_ENTRADA = BASE_DIR.parent / "tipologias_steam_800_escuelas.xlsx"
ARCHIVO_SALIDA = BASE_DIR / "data.js"
N_INICIALES = 40

CENTROIDES = {
    "Capital": (-25.29, -57.60),
    "Central": (-25.45, -57.45),
    "Alto Paraná": (-25.45, -54.90),
    "San Pedro": (-24.15, -56.60),
    "Caaguazú": (-25.45, -55.90),
    "Cordillera": (-25.30, -57.05),
    "Paraguarí": (-25.85, -57.05),
    "Itapúa": (-26.90, -55.90),
    "Guairá": (-25.80, -56.35),
    "Concepción": (-23.10, -57.25),
    "Misiones": (-26.85, -57.10),
    "Canindeyú": (-24.25, -55.40),
    "Caazapá": (-26.15, -56.25),
    "Presidente Hayes": (-24.10, -59.30),
    "Amambay": (-22.75, -56.00),
    "Ñeembucú": (-26.80, -58.00),
    "Boquerón": (-22.35, -60.40),
    "Alto Paraguay": (-20.60, -58.90),
}

# Radio del desplazamiento en grados; Capital es chica y va con radio menor
RADIO = {"Capital": 0.04, "Central": 0.15}


def desplazamiento(clave: str, depto: str) -> tuple[float, float]:
    h = hashlib.md5(clave.encode()).digest()
    r = RADIO.get(depto, 0.35)
    return ((h[0] / 255 - 0.5) * 2 * r, (h[1] / 255 - 0.5) * 2 * r)


def main() -> None:
    df = pd.read_excel(ARCHIVO_ENTRADA, sheet_name="Escuelas")
    df.columns = [str(c).strip() for c in df.columns]
    col_nombre = next(c for c in df.columns if c.startswith("Descripci"))

    sel = df[df["Seleccionado"] == "SI"]
    primeras = sel.sort_values("Matricula_media", ascending=False).groupby("Departamento").head(1)
    resto = sel.drop(primeras.index).sort_values("Matricula_media", ascending=False)
    iniciales = set(pd.concat([primeras, resto]).head(N_INICIALES).index)

    sedes, vistos = [], set()
    for idx, f in df.iterrows():
        cod = str(f["Cod.Establ"]).strip()
        clave = cod
        n = 2
        while clave in vistos:
            clave = f"{cod}-{n}"
            n += 1
        vistos.add(clave)
        depto = str(f["Departamento"]).strip()
        lat0, lon0 = CENTROIDES.get(depto, (-25.3, -57.6))
        dlat, dlon = desplazamiento(clave, depto)
        sedes.append(
            {
                "id": clave,
                "nombre": str(f[col_nombre]).strip().title(),
                "depto": depto,
                "distrito": str(f["Distrito"]).strip().title(),
                "zona": str(f["Zona"]).strip(),
                "tip": str(f["Tipologia_tamano"]),
                "tipNombre": str(f["Tipologia"]),
                "perfil": str(f["Perfil_oferta"]),
                "media": int(f["Matricula_media"]),
                "matric": int(f["Matric. 2024"]),
                "sel": f["Seleccionado"] == "SI",
                "ini": idx in iniciales,
                "lat": round(lat0 + dlat, 5),
                "lon": round(lon0 + dlon, 5),
            }
        )

    js = "window.SEDES = " + json.dumps(sedes, ensure_ascii=False, separators=(",", ":")) + ";\n"
    ARCHIVO_SALIDA.write_text(js, encoding="utf-8")
    print(f"Sedes: {len(sedes)} | con laboratorio: {sum(s['sel'] for s in sedes)} | "
          f"iniciales: {sum(s['ini'] for s in sedes)} -> {ARCHIVO_SALIDA}")


if __name__ == "__main__":
    main()
