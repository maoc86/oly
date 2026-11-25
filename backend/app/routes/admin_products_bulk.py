"""Carga masiva de productos desde Excel.

Proporciona:
- Plantilla descargable (xlsx) con las columnas esperadas.
- Endpoint de carga que parsea el xlsx y crea productos (y variantes) en lote.
"""

import io
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, ProductVariant, Category, User
from app.routes.admin_products import _unique_slug, slugify, _add_variant
from app.schemas import ProductCreate, ProductVariantCreate
from app.routes.products import product_to_list
from app.utils.auth import require_permission

router = APIRouter(prefix="/admin/products/import", tags=["admin-products-bulk"])

# Columnas de la plantilla de productos (en orden).
PRODUCT_COLUMNS = [
    ("name", "Nombre *"),
    ("sku", "SKU"),
    ("description", "Descripción"),
    ("price", "Precio (USD) *"),
    ("wholesale_price", "Precio mayor"),
    ("offer_price", "Precio oferta"),
    ("offer_active", "Oferta activa (TRUE/FALSE)"),
    ("cost", "Costo (USD)"),
    ("category", "Categoría"),
    ("brand", "Marca"),
    ("gender", "Género (mujer/hombre/unisex)"),
    ("image_url", "Imagen (URL)"),
    ("is_featured", "Destacado (TRUE/FALSE)"),
    ("is_new", "Nuevo (TRUE/FALSE)"),
    ("is_active", "Activo (TRUE/FALSE)"),
]

VARIANT_COLUMNS = [
    ("product_sku", "SKU del producto *"),
    ("size", "Talla"),
    ("color", "Color"),
    ("sku", "SKU variante"),
    ("price_override", "Precio override"),
    ("stock", "Stock"),
    ("min_stock", "Stock mínimo"),
    ("image_url", "Imagen (URL)"),
    ("is_active", "Activo (TRUE/FALSE)"),
]


def _build_template() -> io.BytesIO:
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
        from openpyxl.utils import get_column_letter
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl no está instalado")

    wb = openpyxl.Workbook()

    # Hoja de productos
    ws = wb.active
    ws.title = "Productos"
    headers = [h for _, h in PRODUCT_COLUMNS]
    ws.append(headers)
    # Estilo de encabezado
    for col_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="C2410C", end_color="C2410C", fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 30

    # Fila de ejemplo
    example = {
        "name": "Legging Compresión Tiro Alto",
        "sku": "LG-001",
        "description": "Legging de compresión con tiro alto.",
        "price": 25.00,
        "wholesale_price": 18.00,
        "offer_price": None,
        "offer_active": False,
        "cost": 12.00,
        "category": "Pantalones",
        "brand": "Oly",
        "gender": "mujer",
        "image_url": "",
        "is_featured": True,
        "is_new": False,
        "is_active": True,
    }
    ws.append([example.get(k) for k, _ in PRODUCT_COLUMNS])
    # Anchos
    for i, (key, h) in enumerate(PRODUCT_COLUMNS, start=1):
        ws.column_dimensions[get_column_letter(i)].width = max(14, len(h) + 2)

    # Hoja de variantes
    ws2 = wb.create_sheet("Variantes")
    headers2 = [h for _, h in VARIANT_COLUMNS]
    ws2.append(headers2)
    for col_idx, h in enumerate(headers2, start=1):
        cell = ws2.cell(row=1, column=col_idx)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="C2410C", end_color="C2410C", fill_type="solid")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws2.row_dimensions[1].height = 30
    # Ejemplo
    ws2.append(["LG-001", "S", "Negro", "LG-001-S-NEG", None, 7, 2, "", True])
    for i, (key, h) in enumerate(VARIANT_COLUMNS, start=1):
        ws2.column_dimensions[get_column_letter(i)].width = max(14, len(h) + 2)

    # Hoja de instrucciones
    ws3 = wb.create_sheet("Instrucciones")
    instructions = [
        ("Plantilla de carga masiva de productos — Oly Official", True),
        ("", False),
        ("Hoja 'Productos': una fila por producto. Los campos marcados con * son obligatorios.", False),
        ("Hoja 'Variantes': una fila por variante (talla/color). Se vinculan al producto por SKU.", False),
        ("", False),
        ("Valores válidos:", True),
        ("- Género: mujer, hombre, unisex", False),
        ("- Activo/Destacado/Nuevo/Oferta activa: TRUE o FALSE", False),
        ("- Categoría: nombre exacto de la categoría (debe existir en el sistema)", False),
        ("- Si no se indica categoría, se crea sin categoría", False),
        ("- Los productos sin SKU se generan con slug automático", False),
        ("- Las variantes se vinculan al producto por el SKU del producto", False),
        ("", False),
        ("Notas:", True),
        ("- La primera fila es el encabezado; no la modifiques", False),
        ("- La fila de ejemplo puede borrarse", False),
        ("- Deja las celdas vacías para campos opcionales", False),
    ]
    for text, bold in instructions:
        ws3.append([text])
        if bold:
            ws3.cell(row=ws3.max_row, column=1).font = Font(bold=True)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def _parse_bool(val) -> bool:
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    return s in ("true", "1", "si", "sí", "yes", "x")


def _parse_float(val) -> Optional[float]:
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _parse_int(val) -> int:
    if val is None or val == "":
        return 0
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return 0


@router.get("/template")
def download_template(
    current_user: User = Depends(require_permission("products.manage")),
):
    buf = _build_template()
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=plantilla_productos_oly.xlsx"},
    )


@router.post("/bulk")
async def bulk_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl no está instalado")

    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="El archivo debe ser .xlsx o .xls")

    contents = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo: {e}")

    # Mapear categorías por nombre
    categories = {c.name.lower().strip(): c for c in db.query(Category).all()}

    created_products = 0
    created_variants = 0
    errors = []

    # Procesar hoja de productos
    ws = wb["Productos"] if "Productos" in wb.sheetnames else wb.active
    # Mapear encabezados
    header_row = [str(c.value).strip().lower() if c.value is not None else "" for c in ws[1]]
    # Crear mapa de columna -> índice
    col_map = {}
    for idx, h in enumerate(header_row):
        for key, label in PRODUCT_COLUMNS:
            if h == label.lower().strip() or h == key.lower():
                col_map[key] = idx
                break

    if "name" not in col_map or "price" not in col_map:
        raise HTTPException(status_code=400, detail="Faltan columnas obligatorias: Nombre y Precio")

    # Mapa de SKU -> product para variantes
    sku_to_product = {}

    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        # Saltar filas vacías
        if all(v is None or str(v).strip() == "" for v in row):
            continue
        try:
            name_val = row[col_map["name"]] if "name" in col_map else None
            name = str(name_val).strip() if name_val is not None else ""
            if not name:
                errors.append({"row": row_idx, "error": "Nombre vacío"})
                continue

            price = _parse_float(row[col_map["price"]] if "price" in col_map else None)
            if price is None or price <= 0:
                errors.append({"row": row_idx, "error": f"Precio inválido para '{name}'"})
                continue

            sku = str(row[col_map["sku"]]).strip() if "sku" in col_map and row[col_map["sku"]] is not None else None
            if sku == "":
                sku = None

            # Verificar SKU duplicado
            if sku and db.query(Product).filter(Product.sku == sku).first():
                errors.append({"row": row_idx, "error": f"SKU '{sku}' ya existe"})
                continue

            description = str(row[col_map["description"]]).strip() if "description" in col_map and row[col_map["description"]] is not None else None
            if description == "":
                description = None

            wholesale_price = _parse_float(row[col_map["wholesale_price"]] if "wholesale_price" in col_map else None)
            offer_price = _parse_float(row[col_map["offer_price"]] if "offer_price" in col_map else None)
            offer_active = _parse_bool(row[col_map["offer_active"]] if "offer_active" in col_map else None)
            cost = _parse_float(row[col_map["cost"]] if "cost" in col_map else None)

            category_name = str(row[col_map["category"]]).strip() if "category" in col_map and row[col_map["category"]] is not None else None
            if category_name == "":
                category_name = None
            category_id = None
            if category_name:
                cat = categories.get(category_name.lower())
                if cat:
                    category_id = cat.id
                else:
                    errors.append({"row": row_idx, "warning": f"Categoría '{category_name}' no encontrada para '{name}'"})

            brand = str(row[col_map["brand"]]).strip() if "brand" in col_map and row[col_map["brand"]] is not None else None
            if brand == "":
                brand = None

            gender = str(row[col_map["gender"]]).strip().lower() if "gender" in col_map and row[col_map["gender"]] is not None else "mujer"
            if gender not in ("mujer", "hombre", "unisex"):
                gender = "mujer"

            image_url = str(row[col_map["image_url"]]).strip() if "image_url" in col_map and row[col_map["image_url"]] is not None else None
            if image_url == "":
                image_url = None

            is_featured = _parse_bool(row[col_map["is_featured"]] if "is_featured" in col_map else None)
            is_new = _parse_bool(row[col_map["is_new"]] if "is_new" in col_map else None)
            is_active = True
            if "is_active" in col_map and row[col_map["is_active"]] is not None:
                is_active = _parse_bool(row[col_map["is_active"]])

            product = Product(
                name=name,
                slug=_unique_slug(db, name),
                sku=sku,
                description=description,
                price=price,
                wholesale_price=wholesale_price,
                offer_price=offer_price,
                offer_active=offer_active,
                cost=cost,
                category_id=category_id,
                brand=brand,
                gender=gender,
                image_url=image_url,
                images=[],
                is_active=is_active,
                is_featured=is_featured,
                is_new=is_new,
            )
            db.add(product)
            db.flush()
            created_products += 1
            if sku:
                sku_to_product[sku] = product
            # También indexar por nombre para variantes
            sku_to_product[name] = product

        except Exception as e:
            errors.append({"row": row_idx, "error": str(e)})
            db.rollback()
            continue

    db.commit()

    # Procesar hoja de variantes
    if "Variantes" in wb.sheetnames:
        ws2 = wb["Variantes"]
        header_row2 = [str(c.value).strip().lower() if c.value is not None else "" for c in ws2[1]]
        col_map2 = {}
        for idx, h in enumerate(header_row2):
            for key, label in VARIANT_COLUMNS:
                if h == label.lower().strip() or h == key.lower():
                    col_map2[key] = idx
                    break

        if "product_sku" in col_map2:
            for row_idx, row in enumerate(ws2.iter_rows(min_row=2, values_only=True), start=2):
                if all(v is None or str(v).strip() == "" for v in row):
                    continue
                try:
                    prod_key = str(row[col_map2["product_sku"]]).strip() if row[col_map2["product_sku"]] is not None else ""
                    if not prod_key:
                        continue
                    product = sku_to_product.get(prod_key)
                    if not product:
                        # Buscar por SKU en DB
                        product = db.query(Product).filter(Product.sku == prod_key).first()
                    if not product:
                        # Buscar por nombre
                        product = db.query(Product).filter(Product.name == prod_key).first()
                    if not product:
                        errors.append({"row": row_idx, "sheet": "Variantes", "error": f"Producto '{prod_key}' no encontrado"})
                        continue

                    size = str(row[col_map2["size"]]).strip() if "size" in col_map2 and row[col_map2["size"]] is not None else "Único"
                    if size == "":
                        size = "Único"
                    color = str(row[col_map2["color"]]).strip() if "color" in col_map2 and row[col_map2["color"]] is not None else None
                    if color == "":
                        color = None
                    v_sku = str(row[col_map2["sku"]]).strip() if "sku" in col_map2 and row[col_map2["sku"]] is not None else None
                    if v_sku == "":
                        v_sku = None
                    price_override = _parse_float(row[col_map2["price_override"]] if "price_override" in col_map2 else None)
                    stock = _parse_int(row[col_map2["stock"]] if "stock" in col_map2 else None)
                    min_stock = _parse_int(row[col_map2["min_stock"]] if "min_stock" in col_map2 else None)
                    v_image = str(row[col_map2["image_url"]]).strip() if "image_url" in col_map2 and row[col_map2["image_url"]] is not None else None
                    if v_image == "":
                        v_image = None
                    v_active = True
                    if "is_active" in col_map2 and row[col_map2["is_active"]] is not None:
                        v_active = _parse_bool(row[col_map2["is_active"]])

                    # Verificar duplicado
                    existing = db.query(ProductVariant).filter(
                        ProductVariant.product_id == product.id,
                        ProductVariant.size == size,
                        ProductVariant.color == color,
                    ).first()
                    if existing:
                        errors.append({"row": row_idx, "sheet": "Variantes", "warning": f"Variante {size}/{color} ya existe para '{product.name}'"})
                        continue

                    variant = ProductVariant(
                        product_id=product.id,
                        sku=v_sku,
                        size=size,
                        color=color,
                        image_url=v_image,
                        price_override=price_override,
                        stock=stock,
                        min_stock=min_stock,
                        is_active=v_active,
                    )
                    db.add(variant)
                    created_variants += 1

                except Exception as e:
                    errors.append({"row": row_idx, "sheet": "Variantes", "error": str(e)})
                    continue

    db.commit()

    return {
        "created_products": created_products,
        "created_variants": created_variants,
        "errors": errors,
        "total_errors": len([e for e in errors if "error" in e]),
        "total_warnings": len([e for e in errors if "warning" in e]),
    }
