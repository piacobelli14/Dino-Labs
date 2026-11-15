import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsLeftRight, faArrowsUpDown, faArrowsUpToLine, faBorderTopLeft, faCircleInfo, faDownload,
  faFile, faLayerGroup, faRotate, faRulerCombined, faSquare, faTableCells,
  faXmark
} from "@fortawesome/free-solid-svg-icons";
import Tippy from "@tippyjs/react";
import * as THREE from "three";
import { showDialog } from "../../../helpers/Alert.jsx";
import Dropdown from "../../../helpers/Dropdown.jsx";
import "../../../styles/mainStyles/Studio/ThreeD/ThreeD.css";

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipFromDirectory(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const total = buffer.byteLength;
  const decoder = new TextDecoder();
  const entries = new Map();

  let directoryOffset = -1;

  for (let index = total - 22; index >= 0; index--) {
    if (view.getUint32(index, true) !== 0x06054b50) continue;

    const candidate = view.getUint32(index + 16, true);

    if (candidate + 4 <= total && view.getUint32(candidate, true) === 0x02014b50) {
      directoryOffset = candidate;
      break;
    }
  }

  if (directoryOffset < 0) {
    for (let index = 0; index + 4 <= total; index++) {
      if (view.getUint32(index, true) === 0x02014b50) {
        directoryOffset = index;
        break;
      }
    }
  }

  if (directoryOffset < 0) return entries;

  let offset = directoryOffset;

  while (offset + 46 <= total && view.getUint32(offset, true) === 0x02014b50) {
    const method = view.getUint16(offset + 10, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    const localOffset = view.getUint32(offset + 42, true);

    let compressedSize = view.getUint32(offset + 20, true);
    let uncompressedSize = view.getUint32(offset + 24, true);

    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) {
      const extraStart = offset + 46 + nameLength;

      let cursor = extraStart;

      while (cursor + 4 <= extraStart + extraLength) {
        const fieldId = view.getUint16(cursor, true);
        const fieldSize = view.getUint16(cursor + 2, true);

        if (fieldId === 0x0001) {
          let field = cursor + 4;

          if (uncompressedSize === 0xffffffff && field + 8 <= total) {
            uncompressedSize = Number(view.getBigUint64(field, true));
            field += 8;
          }

          if (compressedSize === 0xffffffff && field + 8 <= total) compressedSize = Number(view.getBigUint64(field, true));

          break;
        }

        cursor += 4 + fieldSize;
      }
    }

    offset += 46 + nameLength + extraLength + commentLength;

    if (localOffset + 30 > total || view.getUint32(localOffset, true) !== 0x04034b50) continue;

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = Math.min(total, dataStart + compressedSize);

    if (!name || dataStart >= total || dataEnd <= dataStart) continue;

    const data = bytes.subarray(dataStart, dataEnd);

    try {
      entries.set(name, method === 0 ? data : await inflateRaw(data));
    } catch (inflateError) {
      continue;
    }
  }

  return entries;
}

async function readZipByScanning(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const total = buffer.byteLength;
  const decoder = new TextDecoder();
  const entries = new Map();
  const headers = [];

  for (let index = 0; index + 30 <= total; index++) {
    if (view.getUint32(index, true) !== 0x04034b50) continue;

    const nameLength = view.getUint16(index + 26, true);
    const extraLength = view.getUint16(index + 28, true);

    if (nameLength === 0 || nameLength > 512 || extraLength > 4096) continue;
    if (index + 30 + nameLength > total) continue;

    const name = decoder.decode(bytes.subarray(index + 30, index + 30 + nameLength));

    if (!/^[\x20-\x7e]+$/.test(name)) continue;

    headers.push({ index, name, nameLength, extraLength });
  }

  let firstCentral = -1;

  for (let index = 0; index + 4 <= total; index++) {
    if (view.getUint32(index, true) === 0x02014b50) {
      firstCentral = index;
      break;
    }
  }

  for (let position = 0; position < headers.length; position++) {
    const header = headers[position];
    const flags = view.getUint16(header.index + 6, true);
    const method = view.getUint16(header.index + 8, true);
    const dataStart = header.index + 30 + header.nameLength + header.extraLength;
    const boundary = position + 1 < headers.length
      ? headers[position + 1].index
      : (firstCentral > dataStart ? firstCentral : total);

    let compressedSize = view.getUint32(header.index + 18, true);

    if ((flags & 0x0008) !== 0 || compressedSize === 0 || dataStart + compressedSize > boundary) {
      compressedSize = Math.max(0, boundary - dataStart - ((flags & 0x0008) !== 0 ? 16 : 0));
    }

    if (dataStart >= total || compressedSize === 0) continue;

    const data = bytes.subarray(dataStart, Math.min(total, dataStart + compressedSize));

    try {
      entries.set(header.name, method === 0 ? data : await inflateRaw(data));
    } catch (inflateError) {
      continue;
    }
  }

  return entries;
}

async function unzipEntries(buffer) {
  const fromDirectory = await readZipFromDirectory(buffer);
  const fromScan = await readZipByScanning(buffer);
  const entries = fromDirectory.size >= fromScan.size ? fromDirectory : fromScan;

  for (const [name, data] of (entries === fromDirectory ? fromScan : fromDirectory)) {
    if (!entries.has(name)) entries.set(name, data);
  }

  if (entries.size === 0) throw new Error("This archive could not be read.");

  return entries;
}

function geometryFromArrays(positions, indices, normals) {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  if (indices && indices.length) geometry.setIndex(indices);

  if (normals && normals.length === positions.length) {
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }

  return geometry;
}

function splitIntoIslands(geometry, limit = 64) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.attributes.position.array;
  const triangleCount = Math.floor(position.length / 9);

  if (triangleCount < 2) return [geometry];

  const keyFor = (index) => `${Math.round(position[index] * 1000)},${Math.round(position[index + 1] * 1000)},${Math.round(position[index + 2] * 1000)}`;
  const vertexIds = new Map();
  const triangleVertices = new Int32Array(triangleCount * 3);

  for (let triangle = 0; triangle < triangleCount; triangle++) {
    for (let corner = 0; corner < 3; corner++) {
      const key = keyFor(triangle * 9 + corner * 3);

      if (!vertexIds.has(key)) vertexIds.set(key, vertexIds.size);

      triangleVertices[triangle * 3 + corner] = vertexIds.get(key);
    }
  }

  const parent = new Int32Array(vertexIds.size);

  for (let index = 0; index < parent.length; index++) parent[index] = index;

  const find = (value) => {
    let root = value;

    while (parent[root] !== root) {
      parent[root] = parent[parent[root]];
      root = parent[root];
    }

    return root;
  };

  const union = (left, right) => {
    const a = find(left);
    const b = find(right);

    if (a !== b) parent[b] = a;
  };

  for (let triangle = 0; triangle < triangleCount; triangle++) {
    union(triangleVertices[triangle * 3], triangleVertices[triangle * 3 + 1]);
    union(triangleVertices[triangle * 3 + 1], triangleVertices[triangle * 3 + 2]);
  }

  const groups = new Map();

  for (let triangle = 0; triangle < triangleCount; triangle++) {
    const root = find(triangleVertices[triangle * 3]);

    if (!groups.has(root)) groups.set(root, []);

    groups.get(root).push(triangle);
  }

  if (groups.size < 2 || groups.size > limit) return [geometry];

  const islands = [];

  for (const triangles of groups.values()) {
    const values = new Float32Array(triangles.length * 9);

    triangles.forEach((triangle, slot) => {
      values.set(position.subarray(triangle * 9, triangle * 9 + 9), slot * 9);
    });

    const island = new THREE.BufferGeometry();

    island.setAttribute("position", new THREE.BufferAttribute(values, 3));
    island.computeVertexNormals();
    islands.push(island);
  }

  return islands.sort((left, right) => right.attributes.position.count - left.attributes.position.count);
}

function describeShape(geometry, scale) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.attributes.position.array;
  const count = position.length / 3;

  if (count === 0) return null;

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let sumX = 0, sumY = 0, sumZ = 0;

  for (let index = 0; index < position.length; index += 3) {
    minX = Math.min(minX, position[index]);
    maxX = Math.max(maxX, position[index]);
    minY = Math.min(minY, position[index + 1]);
    maxY = Math.max(maxY, position[index + 1]);
    minZ = Math.min(minZ, position[index + 2]);
    maxZ = Math.max(maxZ, position[index + 2]);
    sumX += position[index];
    sumY += position[index + 1];
    sumZ += position[index + 2];
  }

  const centre = { x: sumX / count, y: sumY / count, z: sumZ / count };
  const extents = [maxX - minX, maxY - minY, maxZ - minZ];
  const radii = [];

  let volume = 0;
  let area = 0;

  for (let index = 0; index + 8 < position.length; index += 9) {
    const ax = position[index], ay = position[index + 1], az = position[index + 2];
    const bx = position[index + 3], by = position[index + 4], bz = position[index + 5];
    const cx = position[index + 6], cy = position[index + 7], cz = position[index + 8];

    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;

    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;

    area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }

  for (let index = 0; index + 8 < position.length; index += 9) {
    const cx = (position[index] + position[index + 3] + position[index + 6]) / 3;
    const cy = (position[index + 1] + position[index + 4] + position[index + 7]) / 3;
    const cz = (position[index + 2] + position[index + 5] + position[index + 8]) / 3;

    radii.push(Math.hypot(cx - centre.x, cy - centre.y, cz - centre.z));
  }

  const meanRadius = radii.reduce((total, value) => total + value, 0) / radii.length;
  const radiusSpread = Math.sqrt(radii.reduce((total, value) => total + (value - meanRadius) ** 2, 0) / radii.length) / (meanRadius || 1);
  const sorted = [...extents].sort((left, right) => left - right);
  const axialIndex = extents.indexOf(Math.max(...extents));
  const crossExtents = extents.filter((_, index) => index !== axialIndex);
  const crossRatio = Math.min(...crossExtents) / (Math.max(...crossExtents) || 1);

  let kind = "Box";
  const metrics = [];

  const extentRatio = Math.max(...extents) / (Math.min(...extents) || 1);
  const sphericity = area > 0 ? (Math.PI ** (1 / 3) * (6 * Math.abs(volume)) ** (2 / 3)) / area : 0;

  if (sphericity > 0.97 && extentRatio < 1.06) {
    kind = "Sphere";
    metrics.push(["Radius", meanRadius / scale], ["Diameter", (meanRadius * 2) / scale]);
  } else if (crossRatio > 0.9 && sorted[2] / (sorted[0] || 1) > 1.2 && radiusSpread < 0.35) {
    const crossRadius = Math.max(...crossExtents) / 2;

    kind = "Cylinder";
    metrics.push(
      ["Diameter", (crossRadius * 2) / scale],
      ["Radius", crossRadius / scale],
      ["Length", extents[axialIndex] / scale],
      ["Circumference", (2 * Math.PI * crossRadius) / scale]
    );
  } else if (Math.abs(sorted[0]) / (sorted[2] || 1) < 0.08) {
    kind = "Sheet";
    metrics.push(["Thickness", sorted[0] / scale], ["Span", sorted[2] / scale]);
  } else if (Math.abs(sorted[0] - sorted[2]) / (sorted[2] || 1) < 0.05) {
    kind = "Cube";
    metrics.push(["Edge", sorted[2] / scale], ["Face Diagonal", (sorted[2] * Math.SQRT2) / scale]);
  }

  metrics.push(
    ["Width", extents[0] / scale],
    ["Height", extents[1] / scale],
    ["Depth", extents[2] / scale],
    ["Diagonal", Math.hypot(...extents) / scale],
    ["Volume", Math.abs(volume) / scale ** 3],
    ["Surface Area", area / scale ** 2],
    ["Centre", `${(centre.x / scale).toFixed(2)}, ${(centre.y / scale).toFixed(2)}, ${(centre.z / scale).toFixed(2)}`]
  );

  return {
    kind,
    sphericity: Number(sphericity.toFixed(3)),
    measurements: metrics.map(([label, value]) => [label, typeof value === "number" ? Number(value.toFixed(3)).toString() : value]),
    triangles: Math.floor(count / 3),
    vertices: count
  };
}

function mergeGeometries(geometries) {
  const valid = geometries.filter((entry) => entry && entry.attributes && entry.attributes.position);

  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];

  const sources = [];

  for (const geometry of valid) {
    try {
      sources.push(geometry.index ? geometry.toNonIndexed() : geometry);
    } catch (conversionError) {
      continue;
    }
  }

  if (sources.length === 0) return null;
  const total = sources.reduce((count, source) => count + source.attributes.position.array.length, 0);
  const positions = new Float32Array(total);

  let cursor = 0;

  for (const source of sources) {
    positions.set(source.attributes.position.array, cursor);
    cursor += source.attributes.position.array.length;
  }

  const merged = new THREE.BufferGeometry();

  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.computeVertexNormals();

  return merged;
}

function matrixFromTransform(value) {
  if (!value) return null;

  const numbers = value.trim().split(/\s+/).map(Number);

  if (numbers.length !== 12 || numbers.some((entry) => Number.isNaN(entry))) return null;

  const matrix = new THREE.Matrix4();

  matrix.set(
    numbers[0], numbers[3], numbers[6], numbers[9],
    numbers[1], numbers[4], numbers[7], numbers[10],
    numbers[2], numbers[5], numbers[8], numbers[11],
    0, 0, 0, 1
  );

  return matrix;
}

function localTag(node, name) {
  for (const child of node.getElementsByTagName("*")) {
    if (child.localName === name) return child;
  }

  return null;
}

function localTags(node, name) {
  return [...node.getElementsByTagName("*")].filter((child) => child.localName === name);
}

function decodeBlendString(bytes, offset, length) {
  let text = "";

  for (let index = 0; index < length; index++) {
    const code = bytes[offset + index];

    if (code === 0) break;

    text += String.fromCharCode(code);
  }

  return text;
}

async function decompressZstandard(bytes) {
  try {
    const module = await import("fzstd");
    const decompress = module.decompress || module.default?.decompress;

    if (typeof decompress !== "function") throw new Error("missing decompressor");

    return decompress(bytes);
  } catch (zstdError) {
    throw new Error("This Blender file uses Zstandard compression, which needs the fzstd package installed.");
  }
}

async function decompressIfNeeded(bytes) {
  if (bytes[0] === 0x28 && bytes[1] === 0xb5 && bytes[2] === 0x2f && bytes[3] === 0xfd) {
    return decompressZstandard(bytes);
  }

  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));

    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  return bytes;
}

function parseBlendMeshes(bytes) {
  const header = decodeBlendString(bytes, 0, 12);

  if (!header.startsWith("BLENDER")) throw new Error("This is not a Blender file.");

  const isVersion5 = header[7] === "1" || header.startsWith("BLENDER17");
  const pointerSize = isVersion5 ? 8 : header[7] === "_" ? 4 : 8;
  const littleEndian = isVersion5 ? true : header[8] === "v";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readPointer = (position) => (pointerSize === 8
    ? view.getBigUint64(position, littleEndian).toString()
    : String(view.getUint32(position, littleEndian)));
  const blocks = [];
  const addresses = new Map();

  let offset = isVersion5 ? 17 : 12;

  while (offset + 16 + pointerSize <= bytes.length) {
    const code = decodeBlendString(bytes, offset, 4);

    let size;
    let address;
    let structureIndex;
    let count;
    let dataStart;

    if (isVersion5) {
      structureIndex = view.getUint32(offset + 4, littleEndian);
      address = view.getBigUint64(offset + 8, littleEndian).toString();
      size = Number(view.getBigUint64(offset + 16, littleEndian));
      count = Number(view.getBigUint64(offset + 24, littleEndian));
      dataStart = offset + 32;
    } else {
      size = view.getUint32(offset + 4, littleEndian);
      address = readPointer(offset + 8);
      structureIndex = view.getUint32(offset + 8 + pointerSize, littleEndian);
      count = view.getUint32(offset + 12 + pointerSize, littleEndian);
      dataStart = offset + 16 + pointerSize;
    }

    if (code === "ENDB" || dataStart + size > bytes.length) break;

    const block = { code, size, address, structureIndex, count, dataStart };

    blocks.push(block);
    addresses.set(address, block);
    offset = dataStart + size;
  }

  const dna = blocks.find((block) => block.code === "DNA1");

  if (!dna) throw new Error("This Blender file has no structure table.");

  let cursor = dna.dataStart + 8;

  const readStrings = () => {
    const total = view.getUint32(cursor, littleEndian);

    cursor += 4;

    const values = [];

    for (let index = 0; index < total; index++) {
      let text = "";

      while (bytes[cursor] !== 0) {
        text += String.fromCharCode(bytes[cursor]);
        cursor += 1;
      }

      cursor += 1;
      values.push(text);
    }

    cursor = (cursor + 3) & ~3;

    return values;
  };

  const names = readStrings();

  cursor += 4;

  const types = readStrings();

  cursor += 4;

  const typeLengths = [];

  for (let index = 0; index < types.length; index++) {
    typeLengths.push(view.getUint16(cursor, littleEndian));
    cursor += 2;
  }

  cursor = (cursor + 3) & ~3;
  cursor += 4;

  const structureCount = view.getUint32(cursor, littleEndian);

  cursor += 4;

  const structures = [];

  for (let index = 0; index < structureCount; index++) {
    const typeIndex = view.getUint16(cursor, littleEndian);
    const fieldCount = view.getUint16(cursor + 2, littleEndian);

    cursor += 4;

    const fields = [];
    let position = 0;

    for (let field = 0; field < fieldCount; field++) {
      const type = types[view.getUint16(cursor, littleEndian)];
      const name = names[view.getUint16(cursor + 2, littleEndian)];
      const isPointer = name.startsWith("*") || name.startsWith("(*");
      const arrays = (name.match(/\[(\d+)\]/g) || []).reduce((total, part) => total * Number(part.slice(1, -1)), 1);
      const size = (isPointer ? pointerSize : typeLengths[view.getUint16(cursor, littleEndian)]) * arrays;

      fields.push({ type, name: name.replace(/[*()[\]0-9]/g, ""), raw: name, offset: position, size, isPointer });
      position += size;
      cursor += 4;
    }

    structures.push({ name: types[typeIndex], fields, size: typeLengths[typeIndex] });
  }

  const structureByName = new Map(structures.map((structure) => [structure.name, structure]));
  const field = (structureName, fieldName) => structureByName.get(structureName)?.fields.find((entry) => entry.name === fieldName) || null;
  const blockAt = (pointer) => (pointer && pointer !== "0" ? addresses.get(pointer) : null);

  const meshStructure = structureByName.get("Mesh");

  if (!meshStructure) throw new Error("This Blender file contains no mesh data.");

  const meshes = blocks.filter((block) => structures[block.structureIndex]?.name === "Mesh");
  const parts = [];

  const readCustomDataLayer = (base, customDataField, layerName) => {
    const layersField = field("CustomData", "layers");
    const totalLayerField = field("CustomData", "totlayer");
    const layerStructure = structureByName.get("CustomDataLayer");

    if (!customDataField || !layersField || !totalLayerField || !layerStructure) return null;

    const customDataStart = base + customDataField.offset;
    const layerBlock = blockAt(readPointer(customDataStart + layersField.offset));
    const totalLayers = view.getInt32(customDataStart + totalLayerField.offset, littleEndian);

    if (!layerBlock) return null;

    const nameField = layerStructure.fields.find((entry) => entry.name === "name");
    const dataField = layerStructure.fields.find((entry) => entry.name === "data");

    for (let index = 0; index < totalLayers; index++) {
      const layerStart = layerBlock.dataStart + index * layerStructure.size;
      const name = decodeBlendString(bytes, layerStart + nameField.offset, nameField.size);

      if (name === layerName) return blockAt(readPointer(layerStart + dataField.offset));
    }

    return null;
  };

  for (const block of meshes) {
    const base = block.dataStart;
    const idField = field("Mesh", "id");
    const idNameField = idField ? structureByName.get("ID")?.fields.find((entry) => entry.name === "name") : null;
    const meshName = idField && idNameField
      ? decodeBlendString(bytes, base + idField.offset + idNameField.offset, idNameField.size).replace(/^ME/, "")
      : `Mesh ${parts.length + 1}`;
    const vertexCountField = field("Mesh", "verts_num") || field("Mesh", "totvert");
    const faceCountField = field("Mesh", "faces_num") || field("Mesh", "totpoly");
    const vertexCount = vertexCountField ? view.getInt32(base + vertexCountField.offset, littleEndian) : 0;
    const faceCount = faceCountField ? view.getInt32(base + faceCountField.offset, littleEndian) : 0;

    let positions = null;
    const positionBlock = readCustomDataLayer(base, field("Mesh", "vert_data") || field("Mesh", "vdata"), "position");

    if (positionBlock) {
      positions = new Float32Array(vertexCount * 3);

      for (let index = 0; index < vertexCount * 3; index++) {
        positions[index] = view.getFloat32(positionBlock.dataStart + index * 4, littleEndian);
      }
    } else {
      const legacy = blockAt(readPointer(base + (field("Mesh", "mvert")?.offset ?? -1)));
      const coordinate = field("MVert", "co");

      if (legacy && coordinate) {
        const stride = structureByName.get("MVert").size;

        positions = new Float32Array(vertexCount * 3);

        for (let index = 0; index < vertexCount; index++) {
          for (let axis = 0; axis < 3; axis++) {
            positions[index * 3 + axis] = view.getFloat32(legacy.dataStart + index * stride + coordinate.offset + axis * 4, littleEndian);
          }
        }
      }
    }

    if (!positions || vertexCount === 0) continue;

    let faceOffsets = null;
    const offsetsField = field("Mesh", "face_offset_indices") || field("Mesh", "poly_offset_indices");
    const offsetsBlock = offsetsField ? blockAt(readPointer(base + offsetsField.offset)) : null;

    if (offsetsBlock) {
      faceOffsets = new Int32Array(faceCount + 1);

      for (let index = 0; index <= faceCount; index++) {
        faceOffsets[index] = view.getInt32(offsetsBlock.dataStart + index * 4, littleEndian);
      }
    }

    let cornerVertices = null;
    const cornerBlock = readCustomDataLayer(base, field("Mesh", "corner_data") || field("Mesh", "ldata"), ".corner_vert");

    if (cornerBlock) {
      cornerVertices = new Int32Array(cornerBlock.size / 4);

      for (let index = 0; index < cornerVertices.length; index++) {
        cornerVertices[index] = view.getInt32(cornerBlock.dataStart + index * 4, littleEndian);
      }
    }

    if (!faceOffsets) {
      const polygonBlock = blockAt(readPointer(base + (field("Mesh", "mpoly")?.offset ?? -1)));
      const loopBlock = blockAt(readPointer(base + (field("Mesh", "mloop")?.offset ?? -1)));
      const startField = field("MPoly", "loopstart");
      const totalField = field("MPoly", "totloop");
      const vertexField = field("MLoop", "v");

      if (polygonBlock && loopBlock && startField && totalField && vertexField) {
        const polygonStride = structureByName.get("MPoly").size;
        const loopStride = structureByName.get("MLoop").size;

        faceOffsets = new Int32Array(faceCount + 1);
        cornerVertices = new Int32Array(loopBlock.size / loopStride);

        for (let index = 0; index < cornerVertices.length; index++) {
          cornerVertices[index] = view.getUint32(loopBlock.dataStart + index * loopStride + vertexField.offset, littleEndian);
        }

        for (let index = 0; index < faceCount; index++) {
          faceOffsets[index] = view.getInt32(polygonBlock.dataStart + index * polygonStride + startField.offset, littleEndian);
        }

        faceOffsets[faceCount] = cornerVertices.length;
      }
    }

    if (!faceOffsets || !cornerVertices) continue;

    const triangles = [];

    for (let face = 0; face < faceCount; face++) {
      const start = faceOffsets[face];
      const end = faceOffsets[face + 1];

      for (let corner = start + 1; corner + 1 < end; corner++) {
        for (const vertexIndex of [cornerVertices[start], cornerVertices[corner], cornerVertices[corner + 1]]) {
          triangles.push(
            positions[vertexIndex * 3],
            positions[vertexIndex * 3 + 2],
            -positions[vertexIndex * 3 + 1]
          );
        }
      }
    }

    if (triangles.length) parts.push({ name: meshName || `Mesh ${parts.length + 1}`, geometry: geometryFromArrays(triangles, null, null) });
  }

  if (parts.length === 0) throw new Error("This Blender file contains no mesh faces.");

  const merged = mergeGeometries(parts.map((part) => part.geometry));

  merged.userData = { parts };

  return merged;
}

function encodeBinarySTL(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.attributes.position.array;
  const triangles = Math.floor(position.length / 9);
  const buffer = new ArrayBuffer(84 + triangles * 50);
  const view = new DataView(buffer);

  view.setUint32(80, triangles, true);

  let offset = 84;

  for (let index = 0; index < triangles; index++) {
    const base = index * 9;
    const ux = position[base + 3] - position[base];
    const uy = position[base + 4] - position[base + 1];
    const uz = position[base + 5] - position[base + 2];
    const vx = position[base + 6] - position[base];
    const vy = position[base + 7] - position[base + 1];
    const vz = position[base + 8] - position[base + 2];

    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;

    const length = Math.hypot(nx, ny, nz) || 1;

    nx /= length;
    ny /= length;
    nz /= length;

    for (const value of [nx, ny, nz, ...position.slice(base, base + 9)]) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }

    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "model/stl" });
}

function encodeAsciiSTL(geometry, name) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.attributes.position.array;
  const lines = [`solid ${name}`];

  for (let index = 0; index + 8 < position.length; index += 9) {
    lines.push("facet normal 0 0 0", "  outer loop");

    for (let corner = 0; corner < 3; corner++) {
      lines.push(`    vertex ${position[index + corner * 3]} ${position[index + corner * 3 + 1]} ${position[index + corner * 3 + 2]}`);
    }

    lines.push("  endloop", "endfacet");
  }

  lines.push(`endsolid ${name}`);

  return new Blob([lines.join("\n")], { type: "model/stl" });
}

function encodeOBJ(geometry, name) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.attributes.position.array;
  const lines = [`o ${name}`];

  for (let index = 0; index + 2 < position.length; index += 3) {
    lines.push(`v ${position[index]} ${position[index + 1]} ${position[index + 2]}`);
  }

  for (let index = 1; index + 2 <= position.length / 3; index += 3) {
    lines.push(`f ${index} ${index + 1} ${index + 2}`);
  }

  return new Blob([lines.join("\n")], { type: "text/plain" });
}

function encodePLY(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.attributes.position.array;
  const vertexCount = position.length / 3;
  const faceCount = Math.floor(vertexCount / 3);
  const lines = [
    "ply",
    "format ascii 1.0",
    `element vertex ${vertexCount}`,
    "property float x",
    "property float y",
    "property float z",
    `element face ${faceCount}`,
    "property list uchar int vertex_index",
    "end_header"
  ];

  for (let index = 0; index + 2 < position.length; index += 3) {
    lines.push(`${position[index]} ${position[index + 1]} ${position[index + 2]}`);
  }

  for (let index = 0; index < faceCount; index++) {
    lines.push(`3 ${index * 3} ${index * 3 + 1} ${index * 3 + 2}`);
  }

  return new Blob([lines.join("\n")], { type: "text/plain" });
}

function encode3MF(geometry, name) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.attributes.position.array;
  const vertices = [];
  const triangles = [];

  for (let index = 0; index + 2 < position.length; index += 3) {
    vertices.push(`<vertex x="${position[index]}" y="${position[index + 1]}" z="${position[index + 2]}"/>`);
  }

  for (let index = 0; index < vertices.length; index += 3) {
    triangles.push(`<triangle v1="${index}" v2="${index + 1}" v3="${index + 2}"/>`);
  }

  const model = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">',
    `<metadata name="Title">${name}</metadata>`,
    '<resources><object id="1" type="model"><mesh>',
    `<vertices>${vertices.join("")}</vertices>`,
    `<triangles>${triangles.join("")}</triangles>`,
    "</mesh></object></resources>",
    '<build><item objectid="1"/></build>',
    "</model>"
  ].join("");
  const contentTypes = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>';
  const relationships = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>';

  return zipStored([
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", relationships],
    ["3D/3dmodel.model", model]
  ]);
}

const crcTable = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index++) {
    let value = index;

    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;

    table[index] = value >>> 0;
  }

  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;

  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);

  return (value ^ 0xffffffff) >>> 0;
}

function zipStored(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];

  let offset = 0;

  for (const [name, text] of files) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const localView = new DataView(local.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centrals.length, true);
  endView.setUint16(10, centrals.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...locals, ...centrals, end], { type: "model/3mf" });
}

function encodeGLB(geometry, name) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.attributes.position.array instanceof Float32Array
    ? source.attributes.position.array
    : Float32Array.from(source.attributes.position.array);
  const bytes = new Uint8Array(position.buffer, position.byteOffset, position.byteLength);
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };

  for (let index = 0; index < position.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] = Math.min(bounds.min[axis], position[index + axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], position[index + axis]);
    }
  }

  const json = {
    asset: { version: "2.0", generator: "Studio" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    accessors: [{
      bufferView: 0,
      componentType: 5126,
      count: position.length / 3,
      type: "VEC3",
      min: bounds.min,
      max: bounds.max
    }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bytes.length }],
    buffers: [{ byteLength: bytes.length }]
  };
  const encoder = new TextEncoder();
  const pad = (input, filler) => {
    const extra = (4 - (input.length % 4)) % 4;
    const padded = new Uint8Array(input.length + extra);

    padded.set(input);
    padded.fill(filler, input.length);

    return padded;
  };
  const jsonChunk = pad(encoder.encode(JSON.stringify(json)), 0x20);
  const binaryChunk = pad(bytes, 0);
  const total = 12 + 8 + jsonChunk.length + 8 + binaryChunk.length;
  const output = new Uint8Array(total);
  const view = new DataView(output.buffer);

  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunk.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  output.set(jsonChunk, 20);
  view.setUint32(20 + jsonChunk.length, binaryChunk.length, true);
  view.setUint32(24 + jsonChunk.length, 0x004e4942, true);
  output.set(binaryChunk, 28 + jsonChunk.length);

  return new Blob([output], { type: "model/gltf-binary" });
}

const EXPORT_FORMATS = {
  "stl-binary": { label: ".stl (Binary)", extension: "stl", encode: (geometry, name) => encodeBinarySTL(geometry, name) },
  "stl-ascii": { label: ".stl (ASCII)", extension: "stl", encode: (geometry, name) => encodeAsciiSTL(geometry, name) },
  obj: { label: ".obj", extension: "obj", encode: (geometry, name) => encodeOBJ(geometry, name) },
  ply: { label: ".ply", extension: "ply", encode: (geometry) => encodePLY(geometry) },
  "3mf": { label: ".3mf", extension: "3mf", encode: (geometry, name) => encode3MF(geometry, name) },
  glb: { label: ".glb", extension: "glb", encode: (geometry, name) => encodeGLB(geometry, name) }
};


function splitIntoShells(geometry, limit = 64) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.attributes.position.array;
  const triangleCount = Math.floor(position.length / 9);

  if (triangleCount === 0) return [geometry];

  const keys = new Map();
  const corner = new Int32Array(triangleCount * 3);

  for (let index = 0; index < triangleCount * 3; index++) {
    const key = `${position[index * 3].toFixed(5)},${position[index * 3 + 1].toFixed(5)},${position[index * 3 + 2].toFixed(5)}`;

    let id = keys.get(key);

    if (id === undefined) {
      id = keys.size;
      keys.set(key, id);
    }

    corner[index] = id;
  }

  const parent = new Int32Array(keys.size);

  for (let index = 0; index < parent.length; index++) parent[index] = index;

  const find = (value) => {
    let root = value;

    while (parent[root] !== root) root = parent[root];

    while (parent[value] !== root) {
      const next = parent[value];

      parent[value] = root;
      value = next;
    }

    return root;
  };

  for (let triangle = 0; triangle < triangleCount; triangle++) {
    const a = find(corner[triangle * 3]);
    const b = find(corner[triangle * 3 + 1]);

    if (a !== b) parent[b] = a;

    const c = find(corner[triangle * 3 + 2]);
    const root = find(corner[triangle * 3]);

    if (root !== c) parent[c] = root;
  }

  const groups = new Map();

  for (let triangle = 0; triangle < triangleCount; triangle++) {
    const root = find(corner[triangle * 3]);

    if (!groups.has(root)) groups.set(root, []);

    groups.get(root).push(triangle);
  }

  if (groups.size <= 1 || groups.size > limit) return [geometry];

  return [...groups.values()]
    .sort((left, right) => right.length - left.length)
    .map((triangles) => {
      const output = new Float32Array(triangles.length * 9);

      triangles.forEach((triangle, index) => {
        output.set(position.subarray(triangle * 9, triangle * 9 + 9), index * 9);
      });

      const shell = new THREE.BufferGeometry();

      shell.setAttribute("position", new THREE.BufferAttribute(output, 3));
      shell.computeVertexNormals();

      return shell;
    });
}

class ModelLoader {
  detectFormat(buffer) {
    const dv = new DataView(buffer);
    const len = buffer.byteLength;

    if (
      len >= 4 &&
      dv.getUint8(0) === 0x50 && dv.getUint8(1) === 0x4b &&
      dv.getUint8(2) === 0x03 && dv.getUint8(3) === 0x04
    ) return "package";

    if (len >= 12) {
      const magic = dv.getUint32(0, true);
      const version = dv.getUint32(4, true);
      if (magic === 0x46546C67 && version === 2) return "glb";
    }

    let headText = "";
    try { headText = new TextDecoder("utf-8").decode(buffer.slice(0, Math.min(8192, len))); } catch (_) { }

    if (headText.trim().startsWith("{") && headText.includes('"asset"') && headText.includes('"version"')) {
      try {
        const json = JSON.parse(headText);
        if (json.asset && json.asset.version) return "gltf";
      } catch (_) { }
    }

    if (headText.includes("<?xml") && headText.includes("<amf")) return "amf";

    if (headText.includes("<?xml") && headText.includes("COLLADA")) return "dae";

    if (headText.includes("<?xml") && (headText.includes("<X3D") || headText.includes("x3d"))) return "x3d";

    if (headText.startsWith("ply")) {
      const fmtLine = headText.split("\n").find(l => l.startsWith("format "));
      if (fmtLine) {
        if (fmtLine.includes("ascii")) return "ply-ascii";
        if (fmtLine.includes("binary_little_endian")) return "ply-binary-le";
        if (fmtLine.includes("binary_big_endian")) return "ply-binary-be";
      }
      return "ply-ascii";
    }

    if (headText.startsWith("BLENDER")) return "blend";

    if (len >= 2 && dv.getUint8(0) === 0x1f && dv.getUint8(1) === 0x8b) return "blend";

    if (len >= 4 && dv.getUint8(0) === 0x28 && dv.getUint8(1) === 0xb5 && dv.getUint8(2) === 0x2f && dv.getUint8(3) === 0xfd) return "blend";

    if (headText.startsWith("OFF")) return "off";

    if (/(^|\n)(o |v |vn |vt |f )/m.test(headText)) return "obj";

    if (headText.startsWith("solid") && /(^|\n)\s*facet\s+normal/m.test(headText)) return "stl-ascii";
    if (len >= 84) {
      const tri = dv.getUint32(80, true);
      const expected = 84 + 50 * tri;
      if (tri > 0 && expected <= len) return "stl-binary";
    }
    return "unknown";
  }

  async load(url, onLoad, onProgress, onError) {
    try {
      const response = await fetch(url);

      if (!response.ok) throw new Error("This model could not be read.");

      const buffer = await response.arrayBuffer();
      const format = this.detectFormat(buffer);

      let geometry = null;

      switch (format) {
        case "stl-ascii": geometry = this.parseASCIISTL(buffer); break;
        case "stl-binary": geometry = this.parseBinarySTL(buffer); break;
        case "obj": geometry = this.parseOBJ(buffer); break;
        case "ply-ascii": geometry = this.parsePLYAscii(buffer); break;
        case "ply-binary-le": geometry = this.parsePLYBinary(buffer, true); break;
        case "ply-binary-be": geometry = this.parsePLYBinary(buffer, false); break;
        case "off": geometry = this.parseOFF(buffer); break;
        case "gltf": geometry = await this.parseGLTF(buffer, url); break;
        case "glb": geometry = await this.parseGLB(buffer, url); break;
        case "dae": geometry = this.parseDAE(buffer); break;
        case "x3d": geometry = this.parseX3D(buffer); break;
        case "amf": geometry = await this.parseAMF(buffer); break;
        case "blend": geometry = await this.parseBlend(buffer); break;
        case "package": geometry = await this.parsePackage(buffer); break;
        default: throw new Error("This file format is not supported by the model viewer.");
      }

      if (!geometry || !geometry.attributes || !geometry.attributes.position) {
        throw new Error("This model contains no geometry.");
      }

      onLoad(geometry);
    } catch (error) {
      onError && onError(error);
    }
  }

  async parsePackage(buffer) {
    const entries = await unzipEntries(buffer);
    const names = [...entries.keys()];

    if (names.some((name) => /3dmodel\.model$/i.test(name) || name.toLowerCase().endsWith(".model"))) {
      return this.parse3MF(buffer);
    }

    if (names.some((name) => name.toLowerCase().endsWith(".amf"))) return this.parseAMF(buffer);

    const inner = names.find((name) => /\.(stl|obj|ply|off|gltf|glb|dae|x3d)$/i.test(name));

    if (!inner) throw new Error("This archive contains no supported model.");

    const data = entries.get(inner);
    const innerBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const format = this.detectFormat(innerBuffer);

    if (format === "package") throw new Error("This archive contains no supported model.");

    return this.loadFromBuffer(innerBuffer, format);
  }

  async loadFromBuffer(buffer, format) {
    switch (format) {
      case "stl-ascii": return this.parseASCIISTL(buffer);
      case "stl-binary": return this.parseBinarySTL(buffer);
      case "obj": return this.parseOBJ(buffer);
      case "ply-ascii": return this.parsePLYAscii(buffer);
      case "ply-binary-le": return this.parsePLYBinary(buffer, true);
      case "ply-binary-be": return this.parsePLYBinary(buffer, false);
      case "off": return this.parseOFF(buffer);
      case "gltf": return this.parseGLTF(buffer, null);
      case "glb": return this.parseGLB(buffer, null);
      case "dae": return this.parseDAE(buffer);
      case "x3d": return this.parseX3D(buffer);
      case "amf": return this.parseAMF(buffer);
      case "blend": return this.parseBlend(buffer);
      default: throw new Error("This file format is not supported by the model viewer.");
    }
  }

  parseASCIISTL(buffer) {
    const text = new TextDecoder().decode(buffer);
    const lines = text.split("\n");
    const vertices = [], normals = [];
    let currentNormal = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith("facet normal")) {
        const p = line.split(/\s+/);
        currentNormal = [parseFloat(p[2]), parseFloat(p[3]), parseFloat(p[4])];
      } else if (line.startsWith("vertex")) {
        const p = line.split(/\s+/);
        vertices.push(parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3]));
        if (currentNormal) normals.push(...currentNormal);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    if (normals.length === vertices.length) {
      geom.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    } else {
      geom.computeVertexNormals();
    }
    return geom;
  }

  parseBinarySTL(buffer) {
    const dv = new DataView(buffer);
    const triCount = dv.getUint32(80, true);
    const expected = 84 + 50 * triCount;
    if (buffer.byteLength < expected) throw new Error("Invalid Binary STL");

    const vertices = new Float32Array(triCount * 9);
    const normals = new Float32Array(triCount * 9);
    let off = 84, idx = 0;

    for (let i = 0; i < triCount; i++) {
      const nx = dv.getFloat32(off, true), ny = dv.getFloat32(off + 4, true), nz = dv.getFloat32(off + 8, true);
      off += 12;
      for (let v = 0; v < 3; v++) {
        vertices[idx] = dv.getFloat32(off, true);
        vertices[idx + 1] = dv.getFloat32(off + 4, true);
        vertices[idx + 2] = dv.getFloat32(off + 8, true);
        normals[idx] = nx; normals[idx + 1] = ny; normals[idx + 2] = nz;
        off += 12; idx += 3;
      }
      off += 2;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geom.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

    let nonZero = false;
    for (let i = 0; i < normals.length; i++) { if (normals[i] !== 0) { nonZero = true; break; } }
    if (!nonZero) geom.computeVertexNormals();

    return geom;
  }

  parseOBJ(buffer) {
    const text = new TextDecoder().decode(buffer);
    const lines = text.split("\n");
    const positions = [], normals = [], outPos = [], outNorm = [];

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const parts = line.split(/\s+/);

      if (parts[0] === "v") positions.push([+parts[1], +parts[2], +parts[3]]);
      else if (parts[0] === "vn") normals.push([+parts[1], +parts[2], +parts[3]]);
      else if (parts[0] === "f") {
        const verts = parts.slice(1);
        const toIdx = (tok) => {
          const [v, , n] = tok.split("/");
          return { v: parseInt(v, 10) - 1, n: n ? parseInt(n, 10) - 1 : -1 };
        };
        const tri = (a, b, c) => {
          const A = toIdx(a), B = toIdx(b), C = toIdx(c);
          const vA = positions[A.v], vB = positions[B.v], vC = positions[C.v];
          if (!vA || !vB || !vC) return;
          outPos.push(...vA, ...vB, ...vC);
          const nA = normals[A.n], nB = normals[B.n], nC = normals[C.n];
          if (nA && nB && nC) outNorm.push(...nA, ...nB, ...nC);
        };
        for (let i = 1; i < verts.length - 1; i++) tri(verts[0], verts[i], verts[i + 1]);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(outPos, 3));
    if (outNorm.length === outPos.length) {
      geom.setAttribute("normal", new THREE.Float32BufferAttribute(outNorm, 3));
    } else {
      geom.computeVertexNormals();
    }
    return geom;
  }

  parsePLYAscii(buffer) {
    const text = new TextDecoder().decode(buffer);
    const lines = text.split("\n");
    let i = 0;

    if (lines[i++].trim() !== "ply") throw new Error("Not PLY");
    const header = [];
    while (i < lines.length) {
      const line = lines[i++].trim();
      header.push(line);
      if (line === "end_header") break;
    }

    let vertexCount = 0, faceCount = 0;
    for (const l of header) {
      if (l.startsWith("element vertex")) vertexCount = parseInt(l.split(/\s+/)[2], 10);
      if (l.startsWith("element face")) faceCount = parseInt(l.split(/\s+/)[2], 10);
    }

    const positions = [];
    for (let v = 0; v < vertexCount; v++) {
      const p = lines[i++].trim().split(/\s+/);
      positions.push([+p[0], +p[1], +p[2]]);
    }

    const out = [];
    for (let f = 0; f < faceCount; f++) {
      const p = lines[i++].trim().split(/\s+/);
      const n = parseInt(p[0], 10);
      const idxs = [];
      for (let k = 1; k <= n; k++) idxs.push(parseInt(p[k], 10));
      for (let t = 1; t < idxs.length - 1; t++) {
        const v0 = positions[idxs[0]], v1 = positions[idxs[t]], v2 = positions[idxs[t + 1]];
        if (v0 && v1 && v2) out.push(...v0, ...v1, ...v2);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
    geom.computeVertexNormals();
    return geom;
  }

  parsePLYBinary(buffer, littleEndian) {
    const bytes = new Uint8Array(buffer);
    let headerEnd = 0;
    for (let i = 0; i < bytes.length - 10; i++) {
      if (
        bytes[i] === 0x65 && bytes[i + 1] === 0x6e && bytes[i + 2] === 0x64 &&
        bytes[i + 3] === 0x5f && bytes[i + 4] === 0x68 && bytes[i + 5] === 0x65 &&
        bytes[i + 6] === 0x61 && bytes[i + 7] === 0x64 && bytes[i + 8] === 0x65 &&
        bytes[i + 9] === 0x72 && (bytes[i + 10] === 0x0a || bytes[i + 10] === 0x0d)
      ) { headerEnd = i + 11; break; }
    }
    if (!headerEnd) throw new Error("PLY header not found");

    const headerText = new TextDecoder().decode(buffer.slice(0, headerEnd));
    const headerLines = headerText.split("\n").map(l => l.trim());

    let vertexCount = 0, faceCount = 0;
    const vertexProps = [];
    let readingVertexProps = false;

    for (const l of headerLines) {
      if (l.startsWith("element vertex")) { vertexCount = parseInt(l.split(/\s+/)[2], 10); readingVertexProps = true; }
      else if (l.startsWith("element face")) { faceCount = parseInt(l.split(/\s+/)[2], 10); readingVertexProps = false; }
      else if (readingVertexProps && l.startsWith("property")) {
        const parts = l.split(/\s+/);
        vertexProps.push({ type: parts[1], name: parts[2] });
      }
    }

    const dv = new DataView(buffer, headerEnd);
    let offset = 0;
    const readScalar = (type) => {
      switch (type) {
        case "char": case "int8": return [dv.getInt8(offset), 1];
        case "uchar": case "uint8": return [dv.getUint8(offset), 1];
        case "short": case "int16": return [dv.getInt16(offset, littleEndian), 2];
        case "ushort": case "uint16": return [dv.getUint16(offset, littleEndian), 2];
        case "int": case "int32": return [dv.getInt32(offset, littleEndian), 4];
        case "uint": case "uint32": return [dv.getUint32(offset, littleEndian), 4];
        case "float": case "float32": return [dv.getFloat32(offset, littleEndian), 4];
        case "double": case "float64": return [dv.getFloat64(offset, littleEndian), 8];
        default: throw new Error("Unsupported PLY type: " + type);
      }
    };

    const positions = new Array(vertexCount);
    for (let v = 0; v < vertexCount; v++) {
      let x = 0, y = 0, z = 0;
      for (let p = 0; p < vertexProps.length; p++) {
        const [val, size] = readScalar(vertexProps[p].type);
        if (p === 0) x = val; else if (p === 1) y = val; else if (p === 2) z = val;
        offset += size;
      }
      positions[v] = [x, y, z];
    }

    const out = [];
    for (let f = 0; f < faceCount; f++) {
      const count = dv.getUint8(offset); offset += 1;
      const idxs = [];
      for (let c = 0; c < count; c++) { idxs.push(dv.getUint32(offset, littleEndian)); offset += 4; }
      for (let t = 1; t < idxs.length - 1; t++) {
        const v0 = positions[idxs[0]], v1 = positions[idxs[t]], v2 = positions[idxs[t + 1]];
        if (v0 && v1 && v2) out.push(...v0, ...v1, ...v2);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
    geom.computeVertexNormals();
    return geom;
  }

  parseOFF(buffer) {
    const text = new TextDecoder().decode(buffer);
    const lines = text.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));

    let lineIdx = 0;
    if (lines[lineIdx] !== "OFF") throw new Error("Not OFF format");
    lineIdx++;

    const [vertexCount, faceCount] = lines[lineIdx++].split(/\s+/).map(n => parseInt(n, 10));

    const positions = [];
    for (let v = 0; v < vertexCount; v++) {
      const [x, y, z] = lines[lineIdx++].split(/\s+/).map(n => parseFloat(n));
      positions.push([x, y, z]);
    }

    const out = [];
    for (let f = 0; f < faceCount; f++) {
      const parts = lines[lineIdx++].split(/\s+/);
      const n = parseInt(parts[0], 10);
      const idxs = [];
      for (let k = 1; k <= n; k++) idxs.push(parseInt(parts[k], 10));

      for (let t = 1; t < idxs.length - 1; t++) {
        const v0 = positions[idxs[0]], v1 = positions[idxs[t]], v2 = positions[idxs[t + 1]];
        if (v0 && v1 && v2) out.push(...v0, ...v1, ...v2);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
    geom.computeVertexNormals();
    return geom;
  }

  async parse3MF(buffer) {
    const entries = await unzipEntries(buffer);
    const decoder = new TextDecoder();
    const modelPaths = [...entries.keys()].filter((path) => path.toLowerCase().endsWith(".model"));

    if (modelPaths.length === 0) throw new Error("This 3MF package does not contain a model.");

    const rootPath = modelPaths.find((path) => /3dmodel\.model$/i.test(path)) || modelPaths[0];
    const documents = new Map();

    for (const path of modelPaths) {
      documents.set(path.replace(/^\/+/, ""), new DOMParser().parseFromString(decoder.decode(entries.get(path)), "application/xml"));
    }

    const resolvePath = (value) => {
      if (!value) return null;

      const cleaned = value.replace(/^\/+/, "");

      return documents.has(cleaned) ? cleaned : [...documents.keys()].find((path) => path.endsWith(cleaned)) || null;
    };

    const unitScale = (document) => {
      const unit = document.documentElement.getAttribute("unit") || "millimeter";

      return unit === "meter" ? 1000 : unit === "centimeter" ? 10 : unit === "inch" ? 25.4 : unit === "foot" ? 304.8 : 1;
    };

    const objectsFor = (path) => {
      const document = documents.get(path);
      const table = new Map();

      if (!document) return table;

      for (const object of localTags(document.documentElement, "object")) {
        table.set(object.getAttribute("id"), object);
      }

      return table;
    };

    const tables = new Map();

    for (const path of documents.keys()) tables.set(path, objectsFor(path));

    const pieces = [];

    const visited = new Set();
    const partNames = [];
    const configNames = new Map();
    const configPath = [...entries.keys()].find((path) => /model_settings\.config$/i.test(path));

    if (configPath) {
      const config = new DOMParser().parseFromString(decoder.decode(entries.get(configPath)), "application/xml");

      for (const object of localTags(config.documentElement, "object")) {
        const objectId = object.getAttribute("id");
        const objectName = [...object.children].find((child) => child.localName === "metadata" && child.getAttribute("key") === "name");

        if (objectName) configNames.set(objectId, objectName.getAttribute("value"));

        for (const part of localTags(object, "part")) {
          const partName = localTags(part, "metadata").find((entry) => entry.getAttribute("key") === "name");

          if (partName) configNames.set(`${objectId}:${part.getAttribute("id")}`, partName.getAttribute("value"));
        }
      }
    }

    const buildObject = (path, id, matrix, depth, label, rootId) => {
      if (depth > 12) return;

      const table = tables.get(path);
      const object = table ? table.get(id) : null;

      if (!object) return;

      visited.add(`${path}#${id}`);

      const scale = unitScale(documents.get(path));
      const mesh = localTag(object, "mesh");

      if (mesh) {
        const positions = [];
        const indices = [];

        for (const vertex of localTags(localTag(mesh, "vertices") || mesh, "vertex")) {
          positions.push(
            Number(vertex.getAttribute("x")) * scale,
            Number(vertex.getAttribute("y")) * scale,
            Number(vertex.getAttribute("z")) * scale
          );
        }

        for (const triangle of localTags(localTag(mesh, "triangles") || mesh, "triangle")) {
          indices.push(
            Number(triangle.getAttribute("v1")),
            Number(triangle.getAttribute("v2")),
            Number(triangle.getAttribute("v3"))
          );
        }

        if (positions.length && indices.length) {
          const geometry = geometryFromArrays(positions, indices, null);

          if (matrix) geometry.applyMatrix4(matrix);

          pieces.push(geometry);
          partNames.push(
            configNames.get(`${rootId}:${id}`)
            || object.getAttribute("name")
            || label
            || configNames.get(rootId)
            || `Part ${pieces.length}`
          );
        }
      }

      const components = localTag(object, "components");

      if (!components) return;

      for (const component of localTags(components, "component")) {
        const childPath = resolvePath(
          component.getAttribute("p:path")
          || component.getAttribute("path")
          || component.getAttributeNS("*", "path")
        ) || path;
        const childMatrix = matrixFromTransform(component.getAttribute("transform"));
        const combined = matrix ? matrix.clone() : new THREE.Matrix4();

        if (childMatrix) combined.multiply(childMatrix);

        buildObject(childPath, component.getAttribute("objectid"), combined, depth + 1, object.getAttribute("name") || label, rootId);
      }
    };

    const rootDocument = documents.get(rootPath);
    const build = rootDocument ? localTag(rootDocument.documentElement, "build") : null;

    if (build) {
      for (const item of localTags(build, "item")) {
        const itemPath = resolvePath(
          item.getAttribute("p:path")
          || item.getAttribute("path")
          || item.getAttributeNS("*", "path")
        ) || rootPath;

        buildObject(itemPath, item.getAttribute("objectid"), matrixFromTransform(item.getAttribute("transform")), 0, null, item.getAttribute("objectid"));
      }
    }

    for (const [path, table] of tables) {
      for (const [id, object] of table) {
        if (visited.has(`${path}#${id}`)) continue;
        if (!localTag(object, "mesh")) continue;

        buildObject(path, id, null, 0, null, id);
      }
    }

    if (pieces.length === 0) throw new Error("This 3MF package contains no mesh data.");

    const merged = mergeGeometries(pieces);

    if (merged) {
      merged.userData = {
        pieces: pieces.length,
        models: documents.size,
        parts: pieces.map((geometry, index) => ({ name: partNames[index] || `Part ${index + 1}`, geometry }))
      };
    }

    return merged;
  }

  async parseBlend(buffer) {
    const bytes = await decompressIfNeeded(new Uint8Array(buffer));

    return parseBlendMeshes(bytes);
  }

  async parseAMF(buffer) {
    const bytes = new Uint8Array(buffer);
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    let text = "";

    if (isZip) {
      const entries = await unzipEntries(buffer);
      const amfPath = [...entries.keys()].find((path) => path.toLowerCase().endsWith(".amf")) || [...entries.keys()][0];

      text = new TextDecoder().decode(entries.get(amfPath));
    } else {
      text = new TextDecoder().decode(buffer);
    }

    const document = new DOMParser().parseFromString(text, "application/xml");
    const unit = document.documentElement.getAttribute("unit") || "millimeter";
    const scale = unit === "meter" ? 1000 : unit === "centimeter" ? 10 : unit === "inch" ? 25.4 : 1;
    const pieces = [];

    for (const mesh of localTags(document.documentElement, "mesh")) {
      const positions = [];

      for (const vertex of localTags(localTag(mesh, "vertices") || mesh, "vertex")) {
        const coordinates = localTag(vertex, "coordinates");

        if (!coordinates) continue;

        positions.push(
          Number(localTag(coordinates, "x")?.textContent || 0) * scale,
          Number(localTag(coordinates, "y")?.textContent || 0) * scale,
          Number(localTag(coordinates, "z")?.textContent || 0) * scale
        );
      }

      for (const volume of localTags(mesh, "volume")) {
        const indices = [];

        for (const triangle of localTags(volume, "triangle")) {
          indices.push(
            Number(localTag(triangle, "v1")?.textContent || 0),
            Number(localTag(triangle, "v2")?.textContent || 0),
            Number(localTag(triangle, "v3")?.textContent || 0)
          );
        }

        if (positions.length && indices.length) pieces.push(geometryFromArrays(positions, indices, null));
      }
    }

    if (!pieces.length) throw new Error("This AMF file contains no mesh data.");

    return mergeGeometries(pieces);
  }

  async parseGLTFDocument(json, binaryChunk, baseUrl) {
    const buffers = [];

    for (const entry of json.buffers || []) {
      if (!entry.uri) {
        buffers.push(binaryChunk);
        continue;
      }

      if (entry.uri.startsWith("data:")) {
        const base64 = entry.uri.slice(entry.uri.indexOf(",") + 1);
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);

        buffers.push(bytes);
        continue;
      }

      const response = await fetch(new URL(entry.uri, baseUrl || window.location.href).href);

      buffers.push(new Uint8Array(await response.arrayBuffer()));
    }

    const componentReaders = {
      5120: { array: Int8Array, size: 1 },
      5121: { array: Uint8Array, size: 1 },
      5122: { array: Int16Array, size: 2 },
      5123: { array: Uint16Array, size: 2 },
      5125: { array: Uint32Array, size: 4 },
      5126: { array: Float32Array, size: 4 }
    };
    const typeCounts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

    const readAccessor = (index) => {
      const accessor = json.accessors?.[index];

      if (!accessor) return null;

      const reader = componentReaders[accessor.componentType];
      const count = typeCounts[accessor.type] || 1;

      if (!reader) return null;

      const view = json.bufferViews?.[accessor.bufferView];

      if (!view) return null;

      const source = buffers[view.buffer || 0];

      if (!source) return null;

      const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
      const stride = view.byteStride || reader.size * count;
      const output = new Float32Array(accessor.count * count);

      for (let element = 0; element < accessor.count; element++) {
        const offset = source.byteOffset + start + element * stride;
        const slice = new reader.array(source.buffer, offset, count);

        for (let component = 0; component < count; component++) output[element * count + component] = slice[component];
      }

      return output;
    };

    const nodeMatrix = (node) => {
      const matrix = new THREE.Matrix4();

      if (node.matrix) return matrix.fromArray(node.matrix);

      const position = new THREE.Vector3().fromArray(node.translation || [0, 0, 0]);
      const rotation = new THREE.Quaternion().fromArray(node.rotation || [0, 0, 0, 1]);
      const scale = new THREE.Vector3().fromArray(node.scale || [1, 1, 1]);

      return matrix.compose(position, rotation, scale);
    };

    const pieces = [];

    const visit = (nodeIndex, parentMatrix) => {
      const node = json.nodes?.[nodeIndex];

      if (!node) return;

      const matrix = parentMatrix.clone().multiply(nodeMatrix(node));

      if (node.mesh !== undefined) {
        for (const primitive of json.meshes?.[node.mesh]?.primitives || []) {
          if (primitive.mode !== undefined && primitive.mode !== 4) continue;

          const positions = readAccessor(primitive.attributes?.POSITION);

          if (!positions) continue;

          const normals = primitive.attributes?.NORMAL !== undefined ? readAccessor(primitive.attributes.NORMAL) : null;
          const indices = primitive.indices !== undefined ? Array.from(readAccessor(primitive.indices) || []) : null;
          const geometry = geometryFromArrays(Array.from(positions), indices, normals ? Array.from(normals) : null);

          geometry.applyMatrix4(matrix);
          pieces.push(geometry);
        }
      }

      for (const child of node.children || []) visit(child, matrix);
    };

    const sceneIndex = json.scene !== undefined ? json.scene : 0;
    const roots = json.scenes?.[sceneIndex]?.nodes || json.nodes?.map((entry, index) => index) || [];

    for (const root of roots) visit(root, new THREE.Matrix4());

    if (!pieces.length) throw new Error("This model contains no triangle meshes.");

    return mergeGeometries(pieces);
  }

  async parseGLTF(buffer, baseUrl) {
    const json = JSON.parse(new TextDecoder().decode(buffer));

    return this.parseGLTFDocument(json, null, baseUrl);
  }

  async parseGLB(buffer, baseUrl) {
    const view = new DataView(buffer);

    if (view.getUint32(0, true) !== 0x46546c67) throw new Error("This GLB file is not valid.");

    const total = view.getUint32(8, true);

    let offset = 12;
    let json = null;
    let binary = null;

    while (offset < Math.min(total, buffer.byteLength)) {
      const length = view.getUint32(offset, true);
      const type = view.getUint32(offset + 4, true);
      const chunk = new Uint8Array(buffer, offset + 8, length);

      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
      if (type === 0x004e4942) binary = chunk;

      offset += 8 + length + ((4 - (length % 4)) % 4);
    }

    if (!json) throw new Error("This GLB file contains no model data.");

    return this.parseGLTFDocument(json, binary, baseUrl);
  }

  parseDAE(buffer) {
    const document = new DOMParser().parseFromString(new TextDecoder().decode(buffer), "application/xml");
    const sources = new Map();

    for (const source of localTags(document.documentElement, "source")) {
      const array = localTag(source, "float_array");

      if (!array) continue;

      sources.set("#" + source.getAttribute("id"), array.textContent.trim().split(/\s+/).map(Number));
    }

    const vertexSource = new Map();

    for (const vertices of localTags(document.documentElement, "vertices")) {
      const input = localTags(vertices, "input").find((entry) => entry.getAttribute("semantic") === "POSITION");

      if (input) vertexSource.set("#" + vertices.getAttribute("id"), input.getAttribute("source"));
    }

    const upAxis = localTag(document.documentElement, "up_axis")?.textContent?.trim() || "Y_UP";
    const pieces = [];

    for (const primitive of [...localTags(document.documentElement, "triangles"), ...localTags(document.documentElement, "polylist")]) {
      const inputs = localTags(primitive, "input");
      const positionInput = inputs.find((entry) => entry.getAttribute("semantic") === "VERTEX")
        || inputs.find((entry) => entry.getAttribute("semantic") === "POSITION");

      if (!positionInput) continue;

      const target = vertexSource.get(positionInput.getAttribute("source")) || positionInput.getAttribute("source");
      const coordinates = sources.get(target);

      if (!coordinates) continue;

      const stride = Math.max(...inputs.map((entry) => Number(entry.getAttribute("offset") || 0))) + 1;
      const positionOffset = Number(positionInput.getAttribute("offset") || 0);
      const indexList = localTag(primitive, "p")?.textContent?.trim().split(/\s+/).map(Number) || [];
      const counts = localTag(primitive, "vcount")?.textContent?.trim().split(/\s+/).map(Number) || null;
      const positions = [];

      const pushVertex = (elementIndex) => {
        const base = indexList[elementIndex * stride + positionOffset] * 3;

        positions.push(coordinates[base], coordinates[base + 1], coordinates[base + 2]);
      };

      if (counts) {
        let cursor = 0;

        for (const count of counts) {
          for (let corner = 1; corner + 1 < count; corner++) {
            pushVertex(cursor);
            pushVertex(cursor + corner);
            pushVertex(cursor + corner + 1);
          }

          cursor += count;
        }
      } else {
        const vertices = indexList.length / stride;

        for (let element = 0; element < vertices; element++) pushVertex(element);
      }

      if (positions.length) pieces.push(geometryFromArrays(positions, null, null));
    }

    if (!pieces.length) throw new Error("This COLLADA file contains no mesh data.");

    const merged = mergeGeometries(pieces);

    if (upAxis === "Z_UP") merged.rotateX(-Math.PI / 2);

    return merged;
  }

  parseX3D(buffer) {
    const document = new DOMParser().parseFromString(new TextDecoder().decode(buffer), "application/xml");
    const pieces = [];

    for (const faceSet of localTags(document.documentElement, "IndexedFaceSet")) {
      const coordinate = localTag(faceSet, "Coordinate");
      const points = (coordinate?.getAttribute("point") || "").trim().split(/[\s,]+/).map(Number).filter((entry) => !Number.isNaN(entry));
      const coordIndex = (faceSet.getAttribute("coordIndex") || "").trim().split(/[\s,]+/).map(Number);

      if (points.length < 3 || coordIndex.length < 3) continue;

      const positions = [];

      let face = [];

      for (const index of coordIndex) {
        if (index === -1) {
          for (let corner = 1; corner + 1 < face.length; corner++) {
            for (const vertex of [face[0], face[corner], face[corner + 1]]) {
              positions.push(points[vertex * 3], points[vertex * 3 + 1], points[vertex * 3 + 2]);
            }
          }

          face = [];
          continue;
        }

        face.push(index);
      }

      if (face.length >= 3) {
        for (let corner = 1; corner + 1 < face.length; corner++) {
          for (const vertex of [face[0], face[corner], face[corner + 1]]) {
            positions.push(points[vertex * 3], points[vertex * 3 + 1], points[vertex * 3 + 2]);
          }
        }
      }

      if (positions.length) pieces.push(geometryFromArrays(positions, null, null));
    }

    if (!pieces.length) throw new Error("This X3D file contains no mesh data.");

    return mergeGeometries(pieces);
  }
}

function clampPosition(rect, width = 180, height = 200, offset = 6) {
  let top = rect.bottom + offset, left = rect.left;
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - offset);
  return { top, left };
}

function ThreeJSViewer({
  modelUrl,
  onLoadError,
  onGeometry,
  onLayers,
  onSelectPart,
  onMeasurePoint,
  selectedParts,
  instanceId,
  hiddenParts,
  unitSize,
  showAxesControl,
  measureMode,
  measurePoints
}) {
  const mountRef = useRef(null);
  const unitSizeRef = useRef(unitSize || 1);

  unitSizeRef.current = unitSize || 1;
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const modelRef = useRef(null);
  const controlsRef = useRef(null);
  const axesGroupRef = useRef(null);
  const gridGroupRef = useRef(null);
  const gridSpacingRef = useRef(1);
  const modelExtentRef = useRef(100);
  const frameRef = useRef(0);
  const [sceneReady, setSceneReady] = useState(false);
  const errorHandlerRef = useRef(null);
  const geometryHandlerRef = useRef(null);
  const layersHandlerRef = useRef(null);
  const partsRef = useRef([]);
  const selectionHandlerRef = useRef(null);
  const measureHandlerRef = useRef(null);
  const measureModeRef = useRef(false);
  const measureGroupRef = useRef(null);
  const selectedPartRef = useRef(null);
  const selectedPartsRef = useRef([]);
  const instanceIdRef = useRef(null);

  instanceIdRef.current = instanceId;
  const autoRotateRef = useRef(false);
  const boundsHelperRef = useRef(null);
  const activeCameraRef = useRef(null);

  errorHandlerRef.current = onLoadError;
  geometryHandlerRef.current = onGeometry;
  layersHandlerRef.current = onLayers;
  selectionHandlerRef.current = onSelectPart;
  measureHandlerRef.current = onMeasurePoint;
  measureModeRef.current = measureMode;

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) return undefined;

    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0x1a1a1a);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 200000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setClearColor(0x1a1a1a);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    const fillLight = new THREE.DirectionalLight(0x4ecdc4, 0.45);
    const rimLight = new THREE.DirectionalLight(0x5c2be2, 0.35);

    keyLight.position.set(80, 120, 90);
    fillLight.position.set(-110, 30, -60);
    rimLight.position.set(40, -90, -110);
    scene.add(keyLight, fillLight, rimLight, new THREE.HemisphereLight(0x2a3346, 0x0d1015, 0.7));

    const backgroundCanvas = document.createElement("canvas");

    backgroundCanvas.width = 2;
    backgroundCanvas.height = 512;

    const backgroundContext = backgroundCanvas.getContext("2d");
    const backgroundGradient = backgroundContext.createLinearGradient(0, 0, 0, 512);

    backgroundGradient.addColorStop(0, "#252b38");
    backgroundGradient.addColorStop(0.55, "#171b24");
    backgroundGradient.addColorStop(1, "#0d1015");
    backgroundContext.fillStyle = backgroundGradient;
    backgroundContext.fillRect(0, 0, 2, 512);

    const backgroundTexture = new THREE.CanvasTexture(backgroundCanvas);

    backgroundTexture.colorSpace = THREE.SRGBColorSpace;
    scene.background = backgroundTexture;

    const gridMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uSpacing: { value: 10 },
        uCamera: { value: new THREE.Vector3() },
        uFade: { value: 400 },
        uMinor: { value: new THREE.Color(0x5b6684) },
        uMajor: { value: new THREE.Color(0x7c89a8) },
        uAxisX: { value: new THREE.Color(0x4ecdc4) },
        uAxisZ: { value: new THREE.Color(0x5c8dff) }
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform float uSpacing;
        uniform vec3 uCamera;
        uniform float uFade;
        uniform vec3 uMinor;
        uniform vec3 uMajor;
        uniform vec3 uAxisX;
        uniform vec3 uAxisZ;
        varying vec3 vWorld;

        float gridLine(vec2 coordinate, float spacing) {
          vec2 scaled = coordinate / spacing;
          vec2 derivative = fwidth(scaled);
          vec2 line = abs(fract(scaled - 0.5) - 0.5) / derivative;
          return 1.0 - min(min(line.x, line.y), 1.0);
        }

        void main() {
          vec2 coordinate = vWorld.xz;
          float minor = gridLine(coordinate, uSpacing);
          float major = gridLine(coordinate, uSpacing * 10.0);
          float distanceToCamera = length(vWorld.xz - uCamera.xz);
          float fade = 1.0 - smoothstep(uFade * 0.25, uFade, distanceToCamera);
          vec3 color = mix(uMinor, uMajor, major);
          float alpha = max(minor * 0.9, major) * fade;

          float axisWidthX = fwidth(vWorld.z) * 1.5;
          float axisWidthZ = fwidth(vWorld.x) * 1.5;

          if (abs(vWorld.z) < axisWidthX) { color = uAxisX; alpha = fade; }
          if (abs(vWorld.x) < axisWidthZ) { color = uAxisZ; alpha = fade; }

          if (alpha < 0.01) discard;

          gl_FragColor = vec4(color, alpha);
        }
      `
    });
    const gridGroup = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gridMaterial);

    gridGroup.rotation.x = -Math.PI / 2;
    gridGroup.renderOrder = -1;
    scene.add(gridGroup);
    gridGroupRef.current = gridGroup;
    gridSpacingRef.current = 10;

    const axes = new THREE.Group();

    for (const [direction, color] of [
      [new THREE.Vector3(0, 1, 0), 0x5c2be2]
    ]) {
      const points = [direction.clone().multiplyScalar(0), direction.clone().multiplyScalar(100000)];

      axes.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color })
      ));
    }

    scene.add(axes);
    axesGroupRef.current = axes;

    const controls = {
      target: new THREE.Vector3(0, 0, 0),
      spherical: new THREE.Spherical(110, Math.PI / 3, Math.PI / 4),
      isOrbiting: false,
      isPanning: false,
      dragged: false,
      pressedButton: null,
      pressOrigin: null,
      lastMouse: { x: 0, y: 0 },
      update() {
        this.spherical.makeSafe();

        const active = activeCameraRef.current || camera;

        active.position.copy(this.target).add(new THREE.Vector3().setFromSpherical(this.spherical));
        active.lookAt(this.target);

        if (active.isOrthographicCamera) {
          const aspect = (mount.clientWidth || 1) / (mount.clientHeight || 1);
          const height = 2 * this.spherical.radius * Math.tan((50 * Math.PI) / 360);

          active.left = (-height * aspect) / 2;
          active.right = (height * aspect) / 2;
          active.top = height / 2;
          active.bottom = -height / 2;
          active.updateProjectionMatrix();
        }

        const grid = gridGroupRef.current;

        if (grid) {
          const radius = this.spherical.radius;
          const unitSize = unitSizeRef.current || 1;
          const spacing = unitSize * 10 ** Math.floor(Math.log10(Math.max(0.001, radius / 12 / unitSize)));
          const extent = radius * 40;

          grid.scale.set(extent, extent, 1);
          grid.position.set(this.target.x, 0, this.target.z);
          grid.material.uniforms.uSpacing.value = spacing;
          grid.material.uniforms.uFade.value = radius * 6;
          grid.material.uniforms.uCamera.value.copy(camera.position);
          gridSpacingRef.current = spacing;
        }
      }
    };

    controls.update();
    controlsRef.current = controls;
    activeCameraRef.current = camera;

    const pickAt = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();

      raycaster.setFromCamera(pointer, activeCameraRef.current || camera);

      return raycaster.intersectObjects(partsRef.current.map((part) => part.mesh), false);
    };

    const onMouseDown = (event) => {
      event.preventDefault();

      controls.pressedButton = event.button;
      controls.pressOrigin = { x: event.clientX, y: event.clientY };
      controls.dragged = false;

      if (event.button === 0 && (event.altKey || event.shiftKey || event.metaKey)) controls.isPanning = true;
      else if (event.button === 0) controls.isOrbiting = true;
      else if (event.button === 1 || event.button === 2) controls.isPanning = true;

      controls.lastMouse = { x: event.clientX, y: event.clientY };
    };

    const onMouseMove = (event) => {
      if (controls.pressOrigin && !controls.dragged) {
        const travelled = Math.hypot(event.clientX - controls.pressOrigin.x, event.clientY - controls.pressOrigin.y);

        if (travelled > 4) controls.dragged = true;
      }

      if (!controls.isOrbiting && !controls.isPanning) return;

      const deltaX = event.clientX - controls.lastMouse.x;
      const deltaY = event.clientY - controls.lastMouse.y;

      controls.lastMouse = { x: event.clientX, y: event.clientY };

      if (controls.isOrbiting) {
        controls.spherical.theta -= deltaX * 0.005;
        controls.spherical.phi = Math.max(0.001, Math.min(Math.PI - 0.001, controls.spherical.phi - deltaY * 0.005));
      } else {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
        const factor = controls.spherical.radius * 0.0015;

        controls.target.addScaledVector(right, -deltaX * factor);
        controls.target.addScaledVector(up, deltaY * factor);
      }

      controls.update();
    };

    const onMouseUp = (event) => {
      const wasDragged = controls.dragged;
      const pressed = controls.pressedButton;

      controls.isOrbiting = false;
      controls.isPanning = false;
      controls.pressedButton = null;
      controls.dragged = false;

      if (pressed !== 0 || wasDragged || !partsRef.current.length) return;

      const hits = pickAt(event);

      if (measureModeRef.current) {
        if (!hits.length) return;

        const hit = hits[0];
        const position = hit.object.geometry.attributes.position;
        const face = hit.face;
        const candidates = face
          ? [face.a, face.b, face.c].map((index) => new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(hit.object.matrixWorld))
          : [];
        const snapped = candidates.reduce(
          (closest, candidate) => (closest && closest.distanceTo(hit.point) <= candidate.distanceTo(hit.point) ? closest : candidate),
          null
        );
        const point = snapped && snapped.distanceTo(hit.point) < hit.distance * 0.08 ? snapped : hit.point;

        measureHandlerRef.current && measureHandlerRef.current({ x: point.x, y: point.y, z: point.z });

        return;
      }

      if (!selectionHandlerRef.current) return;

      const additive = event.shiftKey || event.metaKey;
      const hitId = hits.length ? partsRef.current.find((part) => part.mesh === hits[0].object)?.id || null : null;

      if (hitId || !additive) selectionHandlerRef.current(hitId, additive);
    };

    const onWheel = (event) => {
      event.preventDefault();
      const extent = modelExtentRef.current || 100;

      controls.spherical.radius = Math.max(extent * 0.05, Math.min(extent * 200, controls.spherical.radius * (event.deltaY > 0 ? 1.1 : 0.9)));
      controls.update();
    };

    const onContextMenu = (event) => event.preventDefault();

    const onResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;

      if (width === 0 || height === 0) return;

      const active = activeCameraRef.current || camera;

      if (active.isOrthographicCamera) {
        const span = controlsRef.current ? controlsRef.current.spherical.radius : 100;
        const frustumHeight = 2 * span * Math.tan((50 * Math.PI) / 360);

        active.left = (-frustumHeight * (width / height)) / 2;
        active.right = (frustumHeight * (width / height)) / 2;
        active.top = frustumHeight / 2;
        active.bottom = -frustumHeight / 2;
      } else {
        active.aspect = width / height;
      }

      active.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    onResize();

    const sizeObserver = new ResizeObserver(onResize);

    sizeObserver.observe(mount);

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("contextmenu", onContextMenu);

    const handleMovementCommand = (event) => {
      if (event.detail?.instance !== instanceIdRef.current) return;

      const { command, dx, dy, scale } = event.detail || {};
      const selected = partsRef.current.find((part) => part.id === selectedPartRef.current);
      const target = selected ? selected.mesh : modelRef.current;

      if (!target) return;

      if (command === "move") {
        target.position.x += dx * scale;
        target.position.z -= dy * scale;
      } else if (command === "rotate") {
        const radians = (scale * Math.PI) / 180;

        target.rotation.x += dy * radians;
        target.rotation.y += dx * radians;
      }
    };

    window.addEventListener("movementCommand", handleMovementCommand);

    const handleViewCommand = (event) => {
      if (event.detail?.instance !== instanceIdRef.current) return;

      const command = event.detail?.command;
      const extent = modelExtentRef.current || 100;
      const bounds = modelRef.current ? new THREE.Box3().setFromObject(modelRef.current) : null;
      const height = bounds && !bounds.isEmpty() ? bounds.max.y : extent / 2;
      const presets = {
        reset: [Math.PI / 3, Math.PI / 4],
        top: [0.001, 0],
        front: [Math.PI / 2, 0],
        side: [Math.PI / 2, Math.PI / 2]
      };

      if (presets[command]) {
        controls.target.set(0, height / 2, 0);
        controls.spherical.set(Math.max(1, extent * 2.2), presets[command][0], presets[command][1]);
        controls.update();
      }

      if (command === "hideGrid" && gridGroupRef.current) gridGroupRef.current.visible = false;
      if (command === "showGrid" && gridGroupRef.current) gridGroupRef.current.visible = true;
      if (command === "hideAxes" && axesGroupRef.current) axesGroupRef.current.visible = false;
      if (command === "showAxes" && axesGroupRef.current) axesGroupRef.current.visible = true;

      if (command === "fit" && modelRef.current) {
        const box = new THREE.Box3().setFromObject(modelRef.current);

        if (!box.isEmpty()) {
          const centre = box.getCenter(new THREE.Vector3());
          const radius = box.getSize(new THREE.Vector3()).length() / 2;

          controls.target.copy(centre);
          controls.spherical.radius = Math.max(1, radius / Math.tan((camera.fov * Math.PI) / 360) * 1.4);
          controls.update();
        }
      }

      if (command === "orthographic" || command === "perspective") {
        const wide = command === "orthographic";
        const distance = controls.spherical.radius;
        const aspect = camera.aspect || 1;
        const frustumHeight = 2 * distance * Math.tan((50 * Math.PI) / 360);
        const replacement = wide
          ? new THREE.OrthographicCamera(
            (-frustumHeight * aspect) / 2,
            (frustumHeight * aspect) / 2,
            frustumHeight / 2,
            -frustumHeight / 2,
            0.01,
            200000
          )
          : new THREE.PerspectiveCamera(50, aspect, 0.01, 200000);

        replacement.position.copy(camera.position);
        replacement.up.copy(camera.up);
        replacement.updateProjectionMatrix();
        cameraRef.current = replacement;
        activeCameraRef.current = replacement;
        controls.update();
        onResize();
      }

      if (command === "wireframe" || command === "solid" || command === "xray") {
        for (const part of partsRef.current) {
          part.mesh.material.wireframe = command === "wireframe";
          part.mesh.material.transparent = command === "xray";
          part.mesh.material.opacity = command === "xray" ? 0.35 : 1;
          part.mesh.material.depthWrite = command !== "xray";
          part.mesh.material.needsUpdate = true;
        }
      }

      if (command === "resetModel" && modelRef.current) {
        modelRef.current.position.set(0, 0, 0);
        modelRef.current.rotation.set(0, 0, 0);

        for (const part of partsRef.current) {
          part.mesh.position.set(0, 0, 0);
          part.mesh.rotation.set(0, 0, 0);
        }
      }

      if (command === "autoRotateOn") autoRotateRef.current = true;
      if (command === "autoRotateOff") autoRotateRef.current = false;

      if (command === "boundsOn" || command === "boundsOff") {
        if (boundsHelperRef.current) {
          scene.remove(boundsHelperRef.current);
          boundsHelperRef.current = null;
        }

        if (command === "boundsOn" && modelRef.current) {
          const helper = new THREE.Box3Helper(new THREE.Box3().setFromObject(modelRef.current), new THREE.Color(0x4ecdc4));

          scene.add(helper);
          boundsHelperRef.current = helper;
        }
      }

      if (command === "color" && event.detail?.color) {
        for (const part of partsRef.current) part.mesh.material.color.set(event.detail.color);
      }

      if (command === "screenshot") {
        renderer.render(scene, activeCameraRef.current || camera);

        const link = document.createElement("a");

        link.href = renderer.domElement.toDataURL("image/png");
        link.download = `${event.detail?.name || "model"}.png`;
        link.click();
      }
    };

    window.addEventListener("threedViewCommand", handleViewCommand);

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);

      if (autoRotateRef.current) {
        controls.spherical.theta += 0.004;
        controls.update();
      }

      renderer.render(scene, activeCameraRef.current || camera);
    };

    animate();

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    setSceneReady(true);

    return () => {
      cancelAnimationFrame(frameRef.current);
      sizeObserver.disconnect();
      window.removeEventListener("movementCommand", handleMovementCommand);
      window.removeEventListener("threedViewCommand", handleViewCommand);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);

      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);

      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (axesGroupRef.current) axesGroupRef.current.visible = showAxesControl !== false;
  }, [showAxesControl, modelUrl]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.update();
  }, [unitSize]);

  useEffect(() => {
    const scene = sceneRef.current;

    if (!scene) return;

    if (measureGroupRef.current) {
      scene.remove(measureGroupRef.current);
      measureGroupRef.current.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      measureGroupRef.current = null;
    }

    if (!measurePoints || measurePoints.length === 0) return;

    const group = new THREE.Group();
    const markerSize = Math.max(0.4, (controlsRef.current?.spherical.radius || 100) * 0.006);

    for (const point of measurePoints) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(markerSize, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x1d6fe0 })
      );

      marker.position.set(point.x, point.y, point.z);
      group.add(marker);
    }

    for (let index = 0; index + 1 < measurePoints.length; index += 2) {
      const start = measurePoints[index];
      const end = measurePoints[index + 1];

      group.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(start.x, start.y, start.z),
          new THREE.Vector3(end.x, end.y, end.z)
        ]),
        new THREE.LineBasicMaterial({ color: 0x4ecdc4 })
      ));
    }

    scene.add(group);
    measureGroupRef.current = group;
  }, [measurePoints]);

  selectedPartRef.current = selectedParts && selectedParts.length === 1 ? selectedParts[0] : null;
  selectedPartsRef.current = selectedParts || [];

  useEffect(() => {
    for (const part of partsRef.current) {
      part.mesh.visible = !(hiddenParts || []).includes(part.id);
      const chosen = (selectedParts || []).includes(part.id);

      part.mesh.material.emissive.setHex(chosen ? 0x1d6fe0 : 0x000000);
      part.mesh.material.emissiveIntensity = chosen ? 0.55 : 0;
    }
  }, [selectedParts, hiddenParts, modelUrl]);

  useEffect(() => {
    if (!sceneReady || !sceneRef.current) return;

    const scene = sceneRef.current;
    const report = errorHandlerRef.current;

    if (modelRef.current) {
      scene.remove(modelRef.current);
      modelRef.current.traverse((node) => {
        if (node.geometry) node.geometry.dispose();
        if (node.material) node.material.dispose();
      });
      modelRef.current = null;
      partsRef.current = [];
    }

    if (!modelUrl) return;

    report && report(null);

    let cancelled = false;
    const loader = new ModelLoader();

    loader.load(
      modelUrl,
      (geometry) => {
        if (cancelled) return;

        const sourceParts = geometry.userData?.parts?.length
          ? geometry.userData.parts
          : [{ name: "Model", geometry }];
        const layers = [];

        for (const part of sourceParts) {
          const shells = splitIntoShells(part.geometry);

          shells.forEach((shell, index) => {
            layers.push({
              name: shells.length > 1 ? `${part.name} Body ${index + 1}` : part.name,
              geometry: shell
            });
          });
        }

        geometry.computeBoundingBox();

        const box = geometry.boundingBox;
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const largest = Math.max(size.x, size.y, size.z) || 1;
        const offset = new THREE.Vector3(-center.x, -box.min.y, -center.z);
        const group = new THREE.Group();

        group.name = "modelNode";
        modelExtentRef.current = largest;
        partsRef.current = layers.map((layer, index) => {
          layer.geometry.translate(offset.x, offset.y, offset.z);

          if (!layer.geometry.attributes.normal) layer.geometry.computeVertexNormals();

          const material = new THREE.MeshStandardMaterial({
            color: 0x9aa3b5,
            metalness: 0.15,
            roughness: 0.55,
            side: THREE.DoubleSide,
            emissive: new THREE.Color(0x000000)
          });
          const mesh = new THREE.Mesh(layer.geometry, material);

          mesh.name = layer.name;
          group.add(mesh);

          return { id: `part-${index}`, name: layer.name, mesh };
        });

        scene.add(group);
        modelRef.current = group;
        geometry.translate(offset.x, offset.y, offset.z);
        geometryHandlerRef.current && geometryHandlerRef.current(geometry, partsRef.current);
        layersHandlerRef.current && layersHandlerRef.current(partsRef.current.map((part) => ({
          id: part.id,
          name: part.name,
          triangles: Math.floor(part.mesh.geometry.attributes.position.count / 3)
        })));

        if (controlsRef.current) {
          controlsRef.current.target.set(0, size.y / 2, 0);
          controlsRef.current.spherical.set(Math.max(1, largest * 2.2), Math.PI / 3, Math.PI / 4);
          controlsRef.current.update();
        }
      },
      undefined,
      (loadError) => {
        if (!cancelled) report && report(loadError?.message || String(loadError));
      }
    );

    return () => { cancelled = true; };
  }, [modelUrl, sceneReady]);

  return (
    <div className="threed3DModelContentWrapper">
      <div ref={mountRef} className="threed3DModelRendererMount" />

    </div>
  );
}

export default function ThreeD({ fileHandle }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modelUrl, setModelUrl] = useState(null);
  const [loadedGeometry, setLoadedGeometry] = useState(null);
  const [layers, setLayers] = useState([]);
  const [selectedParts, setSelectedParts] = useState([]);
  const instanceIdRef = useRef(`threed-${Math.random().toString(36).slice(2)}-${Date.now()}`);
  const instanceId = instanceIdRef.current;


  const toggleSelection = (id, additive) => {
    setSelectedParts((previous) => {
      if (!id) return [];

      if (!additive) return previous.length === 1 && previous[0] === id ? [] : [id];

      return previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id];
    });
  };
  const [hiddenParts, setHiddenParts] = useState([]);
  const [gridVisible, setGridVisible] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [displayUnit, setDisplayUnit] = useState("mm");
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [showMeasurePanel, setShowMeasurePanel] = useState(false);
  const [showDisplayPanel, setShowDisplayPanel] = useState(true);
  const [showMovementPanel, setShowMovementPanel] = useState(true);
  const [axesVisible, setAxesVisible] = useState(true);
  const [orthographic, setOrthographic] = useState(false);
  const [shadingMode, setShadingMode] = useState("solid");
  const [modelColor, setModelColor] = useState("#9aa3b5");
  const [boundsVisible, setBoundsVisible] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const loadedPartsRef = useRef([]);

  const unitSizes = { mm: 1, cm: 10, m: 1000, in: 25.4 };
  const unitLabels = { mm: "Millimetres", cm: "Centimetres", m: "Metres", in: "Inches" };
  const measuredGeometry = (() => {
    if (selectedParts.length === 1) {
      const chosen = loadedPartsRef.current.find((part) => part.id === selectedParts[0]);

      if (chosen?.geometry) return chosen.geometry;
    }

    return loadedGeometry;
  })();

  const measuredLabel = selectedParts.length === 1
    ? (layers.find((layer) => layer.id === selectedParts[0])?.name || "Selected Layer")
    : selectedParts.length > 1
      ? `${selectedParts.length} Layers Selected`
      : "Whole Model";

  const shapeDescription = measuredGeometry && selectedParts.length <= 1
    ? describeShape(measuredGeometry, unitSizes[displayUnit] || 1)
    : null;

  const geometryStatistics = (() => {
    if (!measuredGeometry) return null;

    const source = measuredGeometry.index ? measuredGeometry.toNonIndexed() : measuredGeometry;
    const position = source.attributes.position.array;
    const scale = unitSizes[displayUnit] || 1;

    let volume = 0;
    let area = 0;

    for (let index = 0; index + 8 < position.length; index += 9) {
      const ax = position[index] / scale, ay = position[index + 1] / scale, az = position[index + 2] / scale;
      const bx = position[index + 3] / scale, by = position[index + 4] / scale, bz = position[index + 5] / scale;
      const cx = position[index + 6] / scale, cy = position[index + 7] / scale, cz = position[index + 8] / scale;

      volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;

      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;

      area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }

    return { volume: Math.abs(volume), area };
  })();

  const measurements = (() => {
    const scale = unitSizes[displayUnit] || 1;
    const pairs = [];

    for (let index = 0; index + 1 < measurePoints.length; index += 2) {
      const start = measurePoints[index];
      const end = measurePoints[index + 1];

      pairs.push({
        distance: Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) / scale,
        deltaX: Math.abs(end.x - start.x) / scale,
        deltaY: Math.abs(end.y - start.y) / scale,
        deltaZ: Math.abs(end.z - start.z) / scale
      });
    }

    return pairs;
  })();

  const modelDimensions = (() => {
    if (!loadedGeometry) return null;

    loadedGeometry.computeBoundingBox();

    const box = loadedGeometry.boundingBox;
    const size = unitSizes[displayUnit] || 1;
    const format = (value) => Number((value / size).toFixed(displayUnit === "mm" ? 1 : 3)).toString();

    return {
      width: format(box.max.x - box.min.x),
      height: format(box.max.y - box.min.y),
      depth: format(box.max.z - box.min.z),
      triangles: Math.floor((loadedGeometry.index ? loadedGeometry.index.count : loadedGeometry.attributes.position.count) / 3)
    };
  })();

  const sendViewCommand = (command, extra) => {
    window.dispatchEvent(new CustomEvent("threedViewCommand", { detail: { instance: instanceId, command, ...(extra || {}) } }));
  };

  const handleModelInformation = async () => {
    if (!loadedGeometry) {
      await showDialog({ title: "Model Information", message: "There is no model loaded.", showCancel: false });

      return;
    }

    loadedGeometry.computeBoundingBox();

    const size = loadedGeometry.boundingBox.getSize(new THREE.Vector3());
    const triangles = (loadedGeometry.index ? loadedGeometry.index.count : loadedGeometry.attributes.position.count) / 3;

    await showDialog({
      title: "Model Information",
      message: [
        `Name: ${displayName}`,
        `Triangles: ${Math.floor(triangles).toLocaleString()}`,
        `Vertices: ${loadedGeometry.attributes.position.count.toLocaleString()}`,
        `Width: ${size.x.toFixed(2)} mm`,
        `Height: ${size.y.toFixed(2)} mm`,
        `Depth: ${size.z.toFixed(2)} mm`
      ].join("\n"),
      showCancel: false
    });
  };
  const [displayName, setDisplayName] = useState("Untitled.stl");
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [movementState, setMovementState] = useState("move");
  const [movementScale, setMovementScale] = useState(1);
  const [movementUnit, setMovementUnit] = useState("mm");

  const menuPortalRef = useRef(null);
  const fileBtnRef = useRef(null);
  const viewBtnRef = useRef(null);
  const modelBtnRef = useRef(null);
  const panelsBtnRef = useRef(null);

  const unitOptions = [
    { value: "mm", label: "mm" },
    { value: "cm", label: "cm" },
    { value: "in", label: "in" },
    { value: "°", label: "°" }
  ];

  useEffect(() => {
    let createdUrl = null;

    async function loadFile() {
      setError(null);
      setLoading(true);
      setModelUrl(null);
      try {
        if (!fileHandle) { setLoading(false); return; }
        const file = await fileHandle.getFile();
        const name = file.name || "Untitled.stl";
        setDisplayName(name);
        createdUrl = URL.createObjectURL(file);
        setModelUrl(createdUrl);
      } catch (error) {
        setError(error?.message || String(error));
      } finally {
        setLoading(false);
      }
    }

    loadFile();
    return () => { if (createdUrl) URL.revokeObjectURL(createdUrl); };
  }, [fileHandle]);

  const handleDownload = async () => {
    if (!loadedGeometry) {
      await showDialog({ title: "Export Failed", message: "There is no model loaded to export.", showCancel: false });

      return;
    }

    const choice = await showDialog({
      title: "Export Model",
      message: "Choose the format and scale for the exported model.",
      inputs: [
        {
          name: "format",
          type: "select",
          label: "Format",
          defaultValue: "stl-binary",
          options: Object.entries(EXPORT_FORMATS).map(([value, entry]) => ({ label: entry.label, value }))
        },
        {
          name: "unit",
          type: "select",
          label: "Unit",
          defaultValue: displayUnit,
          options: [
            { label: "Millimetres", value: "mm" },
            { label: "Centimetres", value: "cm" },
            { label: "Metres", value: "m" },
            { label: "Inches", value: "in" }
          ]
        }
      ],
      showCancel: true
    });

    if (!choice) return;

    try {
      const format = EXPORT_FORMATS[choice.format] || EXPORT_FORMATS["stl-binary"];
      const scales = { mm: 1, cm: 0.1, m: 0.001, in: 1 / 25.4 };
      const scale = scales[choice.unit] || 1;
      const visibleParts = loadedPartsRef.current.filter((part) => !hiddenParts.includes(part.id));
      const working = visibleParts.length && visibleParts.length !== loadedPartsRef.current.length
        ? mergeGeometries(visibleParts.map((part) => {
          const copy = part.mesh.geometry.clone();

          part.mesh.updateMatrixWorld(true);
          copy.applyMatrix4(part.mesh.matrixWorld);

          return copy;
        }))
        : loadedGeometry.clone();

      if (scale !== 1) working.scale(scale, scale, scale);

      const baseName = displayName.replace(/\.\w+$/, "");
      const blob = format.encode(working, baseName);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = `${baseName}.${format.extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (exportError) {
      await showDialog({ title: "Export Failed", message: exportError?.message || String(exportError), showCancel: false });
    }
  };

  useEffect(() => {
    const down = (e) => {
      if (openMenu && !menuPortalRef.current?.contains(e.target) && !e.target.closest(".threed3DModelOperationsButton")) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", down, true);
    return () => document.removeEventListener("mousedown", down, true);
  }, [openMenu]);

  const openTopMenu = (name, btnRef) => {
    setOpenMenu((prev) => (prev === name ? null : name));
    if (btnRef.current) setMenuPosition(clampPosition(btnRef.current.getBoundingClientRect()));
  };

  const renderDropdownMenu = (menuName, items) => {
    if (openMenu !== menuName) return null;
    return createPortal(
      <div className="threed3DModelDropdownMenu" ref={menuPortalRef} style={{ top: menuPosition.top, left: menuPosition.left }}>
        {items.map((item, i) => (
          <div
            className="threed3DModelDropdownMenuItem"
            key={i}
            onClick={() => { item.action(); setOpenMenu(null); }}
          >
            {item.icon && <FontAwesomeIcon icon={item.icon} />}
            {item.text}
          </div>
        ))}
      </div>,
      document.body
    );
  };

  const sendMovementCommand = (dx, dy) => {
    const scale = parseFloat(movementScale) || 1.0;
    const event = new CustomEvent("movementCommand", { detail: { instance: instanceId, command: movementState, dx, dy, scale } });
    window.dispatchEvent(event);
  };

  const LoadingUI = (
    <div className="threed3DModelLoadingWrapper">
      <div className="threed3DModelLoadingCircle" />
      <label className="threed3DModelLoadingTitle">Loading</label>
    </div>
  );

  return (
    <div className="threed3DModelPageWrapper">
      <div className="threed3DModelToolbarWrapper">
        <div className="threed3DModelToolBar">
          <div className="threed3DModelTitleWrapper">
            <div className="threed3DModelFileNameStack">
              <label className="threed3DModelFileNameInput">
                <FontAwesomeIcon icon={faFile} /> {displayName}
              </label>
              <div className="threed3DModelOperationsButtonsWrapper">
                <button ref={fileBtnRef} className="threed3DModelOperationsButton" onClick={() => openTopMenu("file", fileBtnRef)}>
                  File
                </button>
                {renderDropdownMenu("file", [
                  { icon: faDownload, text: "Export", action: handleDownload },
                  { icon: faFile, text: "Save Screenshot", action: () => sendViewCommand("screenshot", { name: displayName.replace(/\.\w+$/, "") }) },
                  { icon: faCircleInfo, text: "Model Information", action: handleModelInformation }
                ])}

                <button ref={viewBtnRef} className="threed3DModelOperationsButton" onClick={() => openTopMenu("view", viewBtnRef)}>
                  View
                </button>
                {renderDropdownMenu("view", [
                  { icon: faRotate, text: "Reset Camera", action: () => sendViewCommand("reset") },
                  { icon: faArrowsUpDown, text: "Fit To Model", action: () => sendViewCommand("fit") },
                  { icon: faArrowsUpDown, text: "Top View", action: () => sendViewCommand("top") },
                  { icon: faArrowsLeftRight, text: "Front View", action: () => sendViewCommand("front") },
                  { icon: faArrowsLeftRight, text: "Side View", action: () => sendViewCommand("side") },
                  { icon: faSquare, text: orthographic ? "Perspective Camera" : "Orthographic Camera", action: () => { setOrthographic(!orthographic); sendViewCommand(orthographic ? "perspective" : "orthographic"); } },
                  { icon: faTableCells, text: gridVisible ? "Hide Grid" : "Show Grid", action: () => { setGridVisible(!gridVisible); sendViewCommand(gridVisible ? "hideGrid" : "showGrid"); } },
                  { icon: faSquare, text: axesVisible ? "Hide Axes" : "Show Axes", action: () => { setAxesVisible(!axesVisible); sendViewCommand(axesVisible ? "hideAxes" : "showAxes"); } }
                ])}

                <button ref={modelBtnRef} className="threed3DModelOperationsButton" onClick={() => openTopMenu("model", modelBtnRef)}>
                  Model
                </button>
                {renderDropdownMenu("model", [
                  { icon: faRotate, text: "Reset Position", action: () => sendViewCommand("resetModel") },
                  { icon: faSquare, text: wireframe ? "Solid Shading" : "Wireframe Shading", action: () => { setWireframe(!wireframe); sendViewCommand(wireframe ? "solid" : "wireframe"); } },
                  { icon: faLayerGroup, text: "Show All Layers", action: () => setHiddenParts([]) },
                  { icon: faLayerGroup, text: "Isolate Selected Layers", action: () => setHiddenParts(selectedParts.length ? layers.filter((layer) => !selectedParts.includes(layer.id)).map((layer) => layer.id) : []) },
                  { icon: faXmark, text: "Clear Selection", action: () => setSelectedParts([]) },
                  { icon: faRulerCombined, text: "Clear Measurements", action: () => setMeasurePoints([]) }
                ])}
              </div>
            </div>
          </div>

          <div className="threed3DModelEditingButtonsWrapper">
          <div className="threed3DModelStatusGroup">
            <span className="threed3DModelStatusItem">
              <FontAwesomeIcon icon={faLayerGroup} />
              <span>{modelDimensions ? `${modelDimensions.triangles.toLocaleString()} Triangles` : "No Model Loaded"}</span>
            </span>
            <span className="threed3DModelStatusItem">
              <FontAwesomeIcon icon={faRulerCombined} />
              <span>
                {modelDimensions
                  ? `${modelDimensions.width} × ${modelDimensions.height} × ${modelDimensions.depth} ${displayUnit}`
                  : "No Dimensions"}
              </span>
            </span>
            <span className="threed3DModelStatusItem">
              <FontAwesomeIcon icon={faTableCells} />
              <span>{unitLabels[displayUnit]}</span>
            </span>
          </div>

            <div className="threed3DModelStatusActions">
              <Tippy content="Reset Camera" theme="tooltip-light">
                <button className="threed3DModelEditingButton threed3DModelStatusIconButton" onClick={() => sendViewCommand("reset")}>
                  <FontAwesomeIcon icon={faRotate} />
                </button>
              </Tippy>
              <Tippy content="Fit To Model" theme="tooltip-light">
                <button className="threed3DModelEditingButton threed3DModelStatusIconButton" onClick={() => sendViewCommand("fit")}>
                  <FontAwesomeIcon icon={faArrowsUpToLine} />
                </button>
              </Tippy>
              <Tippy content="Top View" theme="tooltip-light">
                <button className="threed3DModelEditingButton threed3DModelStatusIconButton" onClick={() => sendViewCommand("top")}>
                  <FontAwesomeIcon icon={faArrowsUpDown} />
                </button>
              </Tippy>
              <Tippy content="Front View" theme="tooltip-light">
                <button className="threed3DModelEditingButton threed3DModelStatusIconButton" onClick={() => sendViewCommand("front")}>
                  <FontAwesomeIcon icon={faArrowsLeftRight} />
                </button>
              </Tippy>
              <Tippy content="Side View" theme="tooltip-light">
                <button className="threed3DModelEditingButton threed3DModelStatusIconButton" onClick={() => sendViewCommand("side")}>
                  <FontAwesomeIcon icon={faBorderTopLeft} />
                </button>
              </Tippy>
            </div>

            <div className="threed3DModelStatusActions">
              <Tippy content="Model Information" theme="tooltip-light">
                <button className="threed3DModelEditingButton threed3DModelStatusIconButton" onClick={handleModelInformation}>
                  <FontAwesomeIcon icon={faCircleInfo} />
                </button>
              </Tippy>
              <Tippy content="Export Model" theme="tooltip-light">
                <button className="threed3DModelEditingButton threed3DModelStatusIconButton" onClick={handleDownload}>
                  <FontAwesomeIcon icon={faDownload} />
                </button>
              </Tippy>
            </div>
          </div>
        </div>
      </div>

      <div className="threed3DModelEditorContentWrapper">
        {error && (
          <div className="threed3DModelErrorCard">
            <div className="threed3DModelErrorCardHeader">
              <span className="threed3DModelErrorCardTitle">
                <FontAwesomeIcon icon={faCircleInfo} /> The Model Could Not Be Loaded
              </span>
              <button className="threed3DModelPanelClose" onClick={() => setError(null)}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <p className="threed3DModelErrorCardMessage">{error}</p>
          </div>
        )}
        <ThreeJSViewer
          modelUrl={modelUrl}
          onLoadError={(message) => setError(message || null)}
          onGeometry={(geometry, parts) => { setLoadedGeometry(geometry); loadedPartsRef.current = parts || []; }}
          onLayers={setLayers}
          onSelectPart={(id, additive) => toggleSelection(id, additive)}
          selectedParts={selectedParts}
          instanceId={instanceId}
          hiddenParts={hiddenParts}
          unitSize={unitSizes[displayUnit]}
          showAxesControl={axesVisible}
          measureMode={measureMode}
          measurePoints={measurePoints}
          onMeasurePoint={(point) => setMeasurePoints((previous) => [...previous, point])}
        />

        <div className="threed3DModelPanelRail">
          <Tippy content="Layers" theme="tooltip-light">
            <button
            className={showLayerPanel ? "threed3DModelRailButton active" : "threed3DModelRailButton"}
            onClick={() => setShowLayerPanel(!showLayerPanel)}
          >
            <FontAwesomeIcon icon={faLayerGroup} />
          </button>
          </Tippy>
          <Tippy content="Display" theme="tooltip-light">
            <button
            className={showDisplayPanel ? "threed3DModelRailButton active" : "threed3DModelRailButton"}
            onClick={() => setShowDisplayPanel(!showDisplayPanel)}
          >
            <FontAwesomeIcon icon={faSquare} />
          </button>
          </Tippy>
          <Tippy content="Controls" theme="tooltip-light">
            <button
            className={showMovementPanel ? "threed3DModelRailButton active" : "threed3DModelRailButton"}
            onClick={() => setShowMovementPanel(!showMovementPanel)}
          >
            <FontAwesomeIcon icon={faArrowsUpDown} />
          </button>
          </Tippy>
          <Tippy content="Measure" theme="tooltip-light">
            <button
            className={showMeasurePanel ? "threed3DModelRailButton active" : "threed3DModelRailButton"}
            onClick={() => setShowMeasurePanel(!showMeasurePanel)}
          >
            <FontAwesomeIcon icon={faRulerCombined} />
          </button>
          </Tippy>
        </div>

        <div className="threed3DModelDock">
        {showLayerPanel && layers.length > 0 && (
          <div className="threed3DModelLayerPanel">
            <div className="threed3DModelPanelHeader">
              <label className="threed3DModelLayerPanelTitle">Layers</label>
              <button className="threed3DModelPanelClose" onClick={() => setShowLayerPanel(false)}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            {layers.map((layer) => (
              <div
                key={layer.id}
                className={selectedParts.includes(layer.id) ? "threed3DModelLayerRow selected" : "threed3DModelLayerRow"}
                onClick={(event) => toggleSelection(layer.id, event.shiftKey || event.metaKey)}
              >
                <span className="threed3DModelLayerName">{layer.name}</span>
                <span className="threed3DModelLayerMeta">{layer.triangles ? `${layer.triangles.toLocaleString()} Tris` : ""}</span>
                <button
                  className="threed3DModelLayerToggle"
                  onClick={(event) => {
                    event.stopPropagation();
                    setHiddenParts((previous) => (previous.includes(layer.id)
                      ? previous.filter((entry) => entry !== layer.id)
                      : [...previous, layer.id]));
                  }}
                >
                  {hiddenParts.includes(layer.id) ? "Show" : "Hide"}
                </button>
              </div>
            ))}
          </div>
        )}

        {showMeasurePanel && (
          <div className="threed3DModelMeasurePanel">
            <div className="threed3DModelPanelHeader">
              <label className="threed3DModelLayerPanelTitle">Measure</label>
              <button className="threed3DModelPanelClose" onClick={() => setShowMeasurePanel(false)}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="threed3DModelPanelButtonRow">
              <button
                className={`threed3DModelMovementModeBtn ${measureMode ? "active" : ""}`}
                onClick={() => setMeasureMode(!measureMode)}
              >
                {measureMode ? "Picking" : "Pick Points"}
              </button>
              <button
                className="threed3DModelMovementModeBtn"
                onClick={() => setMeasurePoints([])}
              >
                Clear
              </button>
            </div>

            <label className="threed3DModelPanelLabel">{measuredLabel}</label>

            {shapeDescription && (
              <div className="threed3DModelReadoutRow">
                <span>Form</span>
                <span>{shapeDescription.kind}</span>
              </div>
            )}

            {shapeDescription?.measurements.map(([label, value]) => (
              <div className="threed3DModelReadoutRow" key={label}>
                <span>{label}</span>
                <span>
                  {label === "Centre" || label === "Centroid"
                    ? `${value} ${displayUnit}`
                    : label === "Volume"
                      ? `${value} ${displayUnit}³`
                      : label === "Surface Area"
                        ? `${value} ${displayUnit}²`
                        : `${value} ${displayUnit}`}
                </span>
              </div>
            ))}
            <div className="threed3DModelReadoutRow">
              <span>Volume</span>
              <span>{geometryStatistics ? `${geometryStatistics.volume.toFixed(2)} ${displayUnit}³` : "None"}</span>
            </div>
            <div className="threed3DModelReadoutRow">
              <span>Surface Area</span>
              <span>{geometryStatistics ? `${geometryStatistics.area.toFixed(2)} ${displayUnit}²` : "None"}</span>
            </div>
            <div className="threed3DModelReadoutRow">
              <span>Bounding Box</span>
              <span>
                {modelDimensions
                  ? `${modelDimensions.width} × ${modelDimensions.height} × ${modelDimensions.depth}`
                  : "None"}
              </span>
            </div>
            <div className="threed3DModelReadoutRow">
              <span>Triangles</span>
              <span>{modelDimensions ? modelDimensions.triangles.toLocaleString() : "0"}</span>
            </div>

            <label className="threed3DModelPanelLabel">Distances</label>

            {measurements.length === 0 && (
              <div className="threed3DModelReadoutRow">
                <span>Pick two points on the model.</span>
              </div>
            )}

            {measurements.map((entry, index) => (
              <div className="threed3DModelReadoutRow" key={index}>
                <span>Span {index + 1}</span>
                <span>
                  {entry.distance.toFixed(3)} {displayUnit} · ΔX {entry.deltaX.toFixed(2)} · ΔY {entry.deltaY.toFixed(2)} · ΔZ {entry.deltaZ.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {showDisplayPanel && (
          <div className="threed3DModelDisplayPanel">
            <div className="threed3DModelPanelHeader">
              <label className="threed3DModelLayerPanelTitle">Display</label>
              <button className="threed3DModelPanelClose" onClick={() => setShowDisplayPanel(false)}>
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <label className="threed3DModelPanelLabel">Units</label>
            <div className="threed3DModelPanelButtonRow">
              {Object.keys(unitSizes).map((key) => (
                <button
                  key={key}
                  className={`threed3DModelMovementModeBtn ${displayUnit === key ? "active" : ""}`}
                  onClick={() => setDisplayUnit(key)}
                >
                  {key}
                </button>
              ))}
            </div>

            <label className="threed3DModelPanelLabel">Shading</label>
            <div className="threed3DModelPanelButtonRow">
              {[["solid", "Solid"], ["wireframe", "Wire"], ["xray", "X-Ray"]].map(([key, label]) => (
                <button
                  key={key}
                  className={`threed3DModelMovementModeBtn ${shadingMode === key ? "active" : ""}`}
                  onClick={() => { setShadingMode(key); sendViewCommand(key); }}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="threed3DModelPanelLabel">Colour</label>
            <div className="threed3DModelPanelButtonRow">
              {["#9aa3b5", "#4ecdc4", "#5c2be2", "#e8b04b", "#e46d6d", "#ebf0f8"].map((color) => (
                <button
                  key={color}
                  className={`threed3DModelSwatch ${modelColor === color ? "active" : ""}`}
                  style={{ background: color }}
                  onClick={() => { setModelColor(color); sendViewCommand("color", { color }); }}
                />
              ))}
            </div>

            <label className="threed3DModelPanelLabel">Scene</label>
            <div className="threed3DModelPanelButtonRow">
              <button
                className={`threed3DModelMovementModeBtn ${axesVisible ? "active" : ""}`}
                onClick={() => { setAxesVisible(!axesVisible); sendViewCommand(axesVisible ? "hideAxes" : "showAxes"); }}
              >
                Axes
              </button>
              <button
                className={`threed3DModelMovementModeBtn ${orthographic ? "active" : ""}`}
                onClick={() => { setOrthographic(!orthographic); sendViewCommand(orthographic ? "perspective" : "orthographic"); }}
              >
                Ortho
              </button>
            </div>
            <div className="threed3DModelPanelButtonRow">
              <button
                className={`threed3DModelMovementModeBtn ${gridVisible ? "active" : ""}`}
                onClick={() => { setGridVisible(!gridVisible); sendViewCommand(gridVisible ? "hideGrid" : "showGrid"); }}
              >
                Grid
              </button>
              <button
                className={`threed3DModelMovementModeBtn ${boundsVisible ? "active" : ""}`}
                onClick={() => { setBoundsVisible(!boundsVisible); sendViewCommand(boundsVisible ? "boundsOff" : "boundsOn"); }}
              >
                Bounds
              </button>
              <button
                className={`threed3DModelMovementModeBtn ${autoRotate ? "active" : ""}`}
                onClick={() => { setAutoRotate(!autoRotate); sendViewCommand(autoRotate ? "autoRotateOff" : "autoRotateOn"); }}
              >
                Spin
              </button>
            </div>
          </div>
        )}

        </div>

        {showMovementPanel && (
        <div className="threed3DModelMovementControlPanel">
          <div className="threed3DModelPanelHeader">
            <label className="threed3DModelLayerPanelTitle">
              {selectedParts.length === 0 ? "Move Model" : selectedParts.length === 1 ? "Move Selected Layer" : `Move ${selectedParts.length} Layers`}
            </label>
            <button className="threed3DModelPanelClose" onClick={() => setShowMovementPanel(false)}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
          <div className="threed3DModelMovementModeButtons">
            <button
              className={`threed3DModelMovementModeBtn ${movementState === "move" ? "active" : ""}`}
              onClick={() => { setMovementState("move"); if (movementUnit === "°") setMovementUnit("mm"); }}
            >
              Move
            </button>
            <button
              className={`threed3DModelMovementModeBtn ${movementState === "rotate" ? "active" : ""}`}
              onClick={() => { setMovementState("rotate"); setMovementUnit("°"); }}
            >
              Rotate
            </button>
          </div>

          <div className="threed3DModelMovementPad">
            <button className="threed3DModelMovementBtn" onClick={() => sendMovementCommand(-1, 1)}>↖</button>
            <button className="threed3DModelMovementBtn" onClick={() => sendMovementCommand(0, 1)}>↑</button>
            <button className="threed3DModelMovementBtn" onClick={() => sendMovementCommand(1, 1)}>↗</button>
            <button className="threed3DModelMovementBtn" onClick={() => sendMovementCommand(-1, 0)}>←</button>
            <div className="threed3DModelMovementCenter" />
            <button className="threed3DModelMovementBtn" onClick={() => sendMovementCommand(1, 0)}>→</button>
            <button className="threed3DModelMovementBtn" onClick={() => sendMovementCommand(-1, -1)}>↙</button>
            <button className="threed3DModelMovementBtn" onClick={() => sendMovementCommand(0, -1)}>↓</button>
            <button className="threed3DModelMovementBtn" onClick={() => sendMovementCommand(1, -1)}>↘</button>
          </div>

          <div className="threed3DModelMovementScaleControls">
            <input
              type="number"
              className="threed3DModelMovementScaleInput"
              value={movementScale}
              onChange={(e) => setMovementScale(parseFloat(e.target.value) || 1)}
              step="0.1"
              min="0.1"
            />
            <Dropdown
              value={(unitOptions.find((u) => u.value === movementUnit) || unitOptions[0]).label}
              onChange={(option) => setMovementUnit((unitOptions.find((u) => u.label === option) || unitOptions[0]).value)}
              options={unitOptions.filter((u) => (movementState === "rotate" ? u.value === "°" : u.value !== "°")).map((u) => u.label)}
              placeholder="Unit"
              className="threed3DModelUnitDropdown"
            />
          </div>

          <div className="threed3DModelControlsHelp">
            <small>Left drag orbits the model, right or alt drag pans it, scrolling zooms, and shift click selects several layers.</small>
          </div>
        </div>
        )}

      </div>
    </div>
  );
}