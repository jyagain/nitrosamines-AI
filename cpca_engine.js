// Based on Novartis Institutes for BioMedical Research Inc. CPCA Script (MIT License)

/**
 * Parses a SMILES string into a chemical graph (atoms and bonds).
 * This is a lightweight, pure JavaScript parser designed to handle nitrosamine structures.
 */
function parseSmiles(smiles) {
    smiles = smiles.trim();
    const atoms = [];
    const bonds = [];
    const branchStack = [];
    const ringClosures = {};
    
    let i = 0;
    let activeAtomIdx = null;
    let currentBondType = null;
    
    while (i < smiles.length) {
        let char = smiles[i];
        
        // Disconnected components
        if (char === '.') {
            activeAtomIdx = null;
            currentBondType = null;
            i++;
            continue;
        }
        
        // Branching
        if (char === '(') {
            branchStack.push(activeAtomIdx);
            i++;
            continue;
        }
        if (char === ')') {
            activeAtomIdx = branchStack.pop();
            i++;
            continue;
        }
        
        // Bonds
        if (char === '-' || char === '=' || char === '#' || char === ':' || char === '/' || char === '\\') {
            let type = 1;
            if (char === '=') type = 2;
            if (char === '#') type = 3;
            if (char === ':') type = 1.5;
            currentBondType = type;
            i++;
            continue;
        }
        
        // Ring closures
        let ringNum = null;
        if (char === '%') {
            ringNum = parseInt(smiles.substring(i + 1, i + 3));
            i += 3;
        } else if (char >= '0' && char <= '9') {
            ringNum = parseInt(char);
            i++;
        }
        
        if (ringNum !== null) {
            if (ringClosures[ringNum] !== undefined) {
                const partnerIdx = ringClosures[ringNum];
                const type = currentBondType !== null ? currentBondType : 1;
                bonds.push({ from: activeAtomIdx, to: partnerIdx, type: type });
                currentBondType = null;
                delete ringClosures[ringNum];
            } else {
                ringClosures[ringNum] = activeAtomIdx;
            }
            continue;
        }
        
        // Atoms
        let atomData = null;
        if (char === '[') {
            let closeIdx = smiles.indexOf(']', i);
            if (closeIdx === -1) {
                throw new Error("Invalid SMILES: unclosed bracket");
            }
            let content = smiles.substring(i + 1, closeIdx);
            
            // Strip leading isotope digits
            content = content.replace(/^\d+/, '');
            
            // Match element
            let elementMatch = content.match(/^(Cl|Br|C|N|O|S|P|F|I|B|H|c|n|o|s)/);
            if (!elementMatch) {
                throw new Error("Unknown element in bracket: [" + content + "]");
            }
            let rawElement = elementMatch[1];
            let isAromatic = (rawElement === rawElement.toLowerCase());
            let element = rawElement.toUpperCase();
            
            let rest = content.substring(rawElement.length);
            
            // Remove stereochemical markers like @ or @@
            rest = rest.replace(/@+/g, '');
            
            // Explicit hydrogens
            let explicitH = null;
            let hMatch = rest.match(/H(\d*)/);
            if (hMatch) {
                explicitH = hMatch[1] === "" ? 1 : parseInt(hMatch[1]);
                rest = rest.replace(/H\d*/, '');
            }
            
            // Charge
            let charge = 0;
            if (rest.includes('+')) {
                let match = rest.match(/\+(\d*)/);
                charge = match[1] === "" ? (rest.split('+').length - 1) : parseInt(match[1]);
            } else if (rest.includes('-')) {
                let match = rest.match(/\-(\d*)/);
                charge = match[1] === "" ? -(rest.split('-').length - 1) : -parseInt(match[1]);
            }
            
            atomData = { element, isAromatic, charge, explicitH };
            i = closeIdx + 1;
        } else {
            // Bare atoms (Cl, Br, C, N, O, S, F, P, I, B, c, n, o, s)
            let symbol = char;
            if (i + 1 < smiles.length) {
                let nextChar = smiles[i + 1];
                if ((char === 'C' && nextChar === 'l') || (char === 'B' && nextChar === 'r')) {
                    symbol = char + nextChar;
                    i += 2;
                } else {
                    i += 1;
                }
            } else {
                i += 1;
            }
            
            let isAromatic = (symbol === symbol.toLowerCase());
            let element = symbol.toUpperCase();
            atomData = { element, isAromatic, charge: 0, explicitH: null };
        }
        
        // Add atom to list
        const atomIdx = atoms.length;
        atoms.push({
            id: atomIdx,
            element: atomData.element,
            isAromatic: atomData.isAromatic,
            charge: atomData.charge,
            explicitH: atomData.explicitH,
            neighbors: []
        });
        
        // Create bond with active atom
        if (activeAtomIdx !== null) {
            let type = currentBondType;
            if (type === null) {
                // If both are aromatic, default to aromatic bond (1.5)
                if (atoms[activeAtomIdx].isAromatic && atoms[atomIdx].isAromatic) {
                    type = 1.5;
                } else {
                    type = 1;
                }
            }
            bonds.push({ from: activeAtomIdx, to: atomIdx, type: type });
            currentBondType = null;
        }
        
        activeAtomIdx = atomIdx;
    }
    
    // Populate neighbors
    for (let bond of bonds) {
        atoms[bond.from].neighbors.push({ id: bond.to, type: bond.type });
        atoms[bond.to].neighbors.push({ id: bond.from, type: bond.type });
    }
    
    return atoms;
}

/**
 * Calculates hydrogen count of a specific atom (incorporating implicit / explicit H).
 */
function getHydrogenCount(atoms, atomIdx) {
    const atom = atoms[atomIdx];
    if (atom.explicitH !== null) {
        return atom.explicitH;
    }
    
    // Count explicit H neighbors in graph (if any)
    let explicitHNeighbors = 0;
    for (let nei of atom.neighbors) {
        if (atoms[nei.id].element === 'H') {
            explicitHNeighbors++;
        }
    }
    if (explicitHNeighbors > 0) {
        return explicitHNeighbors;
    }
    
    if (atom.element === 'H') return 0;
    
    // Standard valence calculation
    let standardValence = 0;
    if (atom.element === 'C') standardValence = 4;
    else if (atom.element === 'N') standardValence = 3;
    else if (atom.element === 'O') standardValence = 2;
    else if (atom.element === 'S') standardValence = 2; // Simple default
    else if (atom.element === 'P') standardValence = 3;
    else if (atom.element === 'F' || atom.element === 'CL' || atom.element === 'BR' || atom.element === 'I') standardValence = 1;
    
    let sumBondOrders = 0;
    for (let nei of atom.neighbors) {
        if (atoms[nei.id].element !== 'H') {
            sumBondOrders += nei.type;
        }
    }
    
    let hCount = standardValence - sumBondOrders - Math.abs(atom.charge);
    return Math.max(0, Math.floor(hCount));
}

/**
 * Cycles finding helper. Returns all simple cycles containing startIdx of size <= maxLen.
 */
function findCyclesContaining(atoms, startIdx, maxLen = 7) {
    const cycles = [];
    
    function dfs(currentIdx, path) {
        if (path.length > maxLen) return;
        
        for (let nei of atoms[currentIdx].neighbors) {
            let neighborIdx = nei.id;
            
            if (neighborIdx === startIdx && path.length >= 3) {
                cycles.push([...path]);
                continue;
            }
            
            if (!path.includes(neighborIdx)) {
                dfs(neighborIdx, [...path, neighborIdx]);
            }
        }
    }
    
    dfs(startIdx, [startIdx]);
    
    // Deduplicate cycles
    const uniqueCycles = [];
    const seen = new Set();
    for (let cycle of cycles) {
        const sortedStr = [...cycle].sort((a,b) => a-b).join(',');
        if (!seen.has(sortedStr)) {
            seen.add(sortedStr);
            uniqueCycles.push(cycle);
        }
    }
    return uniqueCycles;
}

/**
 * Finds all simple cycles in the molecule of size <= maxLen.
 */
function findAllCycles(atoms, maxLen = 7) {
    const cycles = [];
    const seen = new Set();
    
    function dfs(currentIdx, path) {
        if (path.length > maxLen) return;
        
        let startIdx = path[0];
        for (let nei of atoms[currentIdx].neighbors) {
            let neighborIdx = nei.id;
            if (neighborIdx === startIdx && path.length >= 3) {
                const cycle = [...path];
                const sortedStr = [...cycle].sort((a,b) => a-b).join(',');
                if (!seen.has(sortedStr)) {
                    seen.add(sortedStr);
                    cycles.push(cycle);
                }
                continue;
            }
            if (!path.includes(neighborIdx)) {
                dfs(neighborIdx, [...path, neighborIdx]);
            }
        }
    }
    
    for (let i = 0; i < atoms.length; i++) {
        dfs(i, [i]);
    }
    return cycles;
}

/**
 * Detects if the nitrogen is part of a saturated pyrrolidine ring.
 */
function isInPyrrolidine(atoms, N_index, cycles) {
    for (let cycle of cycles) {
        if (cycle.length !== 5) continue;
        if (!cycle.includes(N_index)) continue;
        
        let nCount = 0;
        let cCount = 0;
        let otherCount = 0;
        for (let idx of cycle) {
            let el = atoms[idx].element;
            if (el === 'N') nCount++;
            else if (el === 'C') cCount++;
            else otherCount++;
        }
        if (nCount === 1 && cCount === 4 && otherCount === 0) {
            // Also ensure it is fully saturated (no double/aromatic bonds inside the ring)
            let isSaturated = true;
            for (let i = 0; i < cycle.length; i++) {
                let u = cycle[i];
                let v = cycle[(i + 1) % cycle.length];
                let bond = atoms[u].neighbors.find(n => n.id === v);
                if (bond && bond.type > 1) {
                    isSaturated = false;
                    break;
                }
            }
            if (isSaturated) return true;
        }
    }
    return false;
}

/**
 * Detects if the nitrogen is part of a saturated morpholine ring.
 */
function isInMorpholine(atoms, N_index, cycles) {
    for (let cycle of cycles) {
        if (cycle.length !== 6) continue;
        if (!cycle.includes(N_index)) continue;
        
        let nCount = 0;
        let oCount = 0;
        let cCount = 0;
        let otherCount = 0;
        for (let idx of cycle) {
            let el = atoms[idx].element;
            if (el === 'N') nCount++;
            else if (el === 'O') oCount++;
            else if (el === 'C') cCount++;
            else otherCount++;
        }
        
        if (nCount === 1 && oCount === 1 && cCount === 4 && otherCount === 0) {
            // Verify opposite position
            let nPos = cycle.indexOf(N_index);
            let oIdx = cycle.find(idx => atoms[idx].element === 'O');
            let oPos = cycle.indexOf(oIdx);
            
            if (oPos !== -1) {
                let dist = Math.abs(nPos - oPos);
                if (dist === 3) {
                    // Ensure saturation
                    let isSaturated = true;
                    for (let i = 0; i < cycle.length; i++) {
                        let u = cycle[i];
                        let v = cycle[(i + 1) % cycle.length];
                        let bond = atoms[u].neighbors.find(n => n.id === v);
                        if (bond && bond.type > 1) {
                            isSaturated = false;
                            break;
                        }
                    }
                    if (isSaturated) return true;
                }
            }
        }
    }
    return false;
}

/**
 * Evaluates Ring deactivating score.
 */
function getRingRelatedScore(atoms, N_index) {
    const cycles = findCyclesContaining(atoms, N_index, 7);
    
    let has5 = cycles.some(c => c.length === 5);
    let has6 = cycles.some(c => c.length === 6);
    let has7 = cycles.some(c => c.length === 7);
    
    if (has5) {
        if (isInPyrrolidine(atoms, N_index, cycles)) {
            return 3;
        }
        return 2;
    }
    
    if (has6) {
        if (isInMorpholine(atoms, N_index, cycles)) {
            return 1;
        }
        
        // Sulfur ring check
        for (let cycle of cycles) {
            if (cycle.length === 6) {
                if (cycle.some(idx => atoms[idx].element === 'S')) {
                    return 3;
                }
            }
        }
        return 2;
    }
    
    if (has7) {
        return 1;
    }
    
    return 0;
}

/**
 * Helper to find all non-H chains of length 6 starting from N.
 */
function findChains(atoms, startIdx, length = 6) {
    const paths = [];
    function dfs(currentIdx, path) {
        if (path.length === length) {
            paths.push(path);
            return;
        }
        
        for (let nei of atoms[currentIdx].neighbors) {
            if (atoms[nei.id].element !== 'H' && !path.includes(nei.id)) {
                dfs(nei.id, [...path, nei.id]);
            }
        }
    }
    dfs(startIdx, [startIdx]);
    return paths;
}

/**
 * Checks if all atoms in a chain are part of the same small ring (<8 atoms).
 */
function isChainInSameRing(atoms, chain) {
    const allCycles = findAllCycles(atoms, 7);
    for (let cycle of allCycles) {
        // If every atom in the chain is in the cycle
        if (chain.every(idx => cycle.includes(idx))) {
            return true;
        }
    }
    return false;
}

/**
 * Evaluates the 5 consecutive non-H atoms chain deactivating feature.
 */
function fiveConsecAtomsScore(atoms, N_index, alpha_carbons) {
    // If N is in a ring of size < 8, this rule is not applied (returns 0)
    const nCycles = findCyclesContaining(atoms, N_index, 7);
    if (nCycles.some(c => c.length < 8)) {
        return 0;
    }
    
    const chains = findChains(atoms, N_index, 6);
    const sideChains = chains.map(p => p.slice(1)); // Length 5 (remove N_index)
    
    const c1 = alpha_carbons[0];
    const c2 = alpha_carbons[1];
    
    const carbon1_chains = sideChains.filter(c => c[0] === c1);
    const carbon2_chains = sideChains.filter(c => c[0] === c2);
    
    if (carbon1_chains.length === 0 || carbon2_chains.length === 0) {
        return 0;
    }
    
    // Check if there is a combination of disjoint chains that are not in same ring
    for (let chain1 of carbon1_chains) {
        if (isChainInSameRing(atoms, chain1)) continue;
        
        for (let chain2 of carbon2_chains) {
            if (isChainInSameRing(atoms, chain2)) continue;
            
            // Check if they share any atoms
            let share = chain1.some(idx => chain2.includes(idx));
            if (!share) {
                return 1;
            }
        }
    }
    return 0;
}

/**
 * Checks if a carbon has a carboxylic acid group connected.
 */
function hasCarboxylicAcid(atoms) {
    for (let atom of atoms) {
        if (atom.element !== 'C') continue;
        
        let hasDoubleO = false;
        let hasSingleOH = false;
        
        for (let nei of atom.neighbors) {
            let neiAtom = atoms[nei.id];
            if (neiAtom.element === 'O') {
                if (nei.type === 2) {
                    hasDoubleO = true;
                } else if (nei.type === 1) {
                    // Check if it is OH (no other heavy neighbors)
                    let heavyNeighbors = 0;
                    for (let o_nei of neiAtom.neighbors) {
                        if (atoms[o_nei.id].element !== 'H') {
                            heavyNeighbors++;
                        }
                    }
                    if (heavyNeighbors === 1) {
                        hasSingleOH = true;
                    }
                }
            }
        }
        if (hasDoubleO && hasSingleOH) {
            return true;
        }
    }
    return false;
}

/**
 * Checks if there is an electron-withdrawing group (EWG) connected to the alpha carbon.
 */
function isEwgOnAlpha(atoms, N_index, cIdx) {
    const cAtom = atoms[cIdx];
    for (let nei of cAtom.neighbors) {
        let neiIdx = nei.id;
        if (neiIdx === N_index) continue; // Skip nitrosamine N
        
        let neiAtom = atoms[neiIdx];
        let el = neiAtom.element;
        
        // 1. Halogen directly attached
        if (el === 'F' || el === 'CL' || el === 'BR' || el === 'I') {
            return true;
        }
        
        // 2. Oxygen directly attached (e.g. ether, hydroxy)
        if (el === 'O') {
            return true;
        }
        
        // 3. Nitrogen directly attached (e.g. amine, amide nitrogen)
        if (el === 'N') {
            return true;
        }
        
        // 4. Sulfur directly attached
        if (el === 'S') {
            return true;
        }
        
        // 5. Carbon neighbor
        if (el === 'C') {
            // Cyano: -C#N
            let isCyano = false;
            for (let c_nei of neiAtom.neighbors) {
                if (atoms[c_nei.id].element === 'N' && c_nei.type === 3) {
                    isCyano = true;
                }
            }
            if (isCyano) return true;
            
            // Trifluoromethyl: -CF3
            let fCount = 0;
            for (let c_nei of neiAtom.neighbors) {
                if (atoms[c_nei.id].element === 'F') {
                    fCount++;
                }
            }
            if (fCount >= 3) return true;
            
            // Sulfonyl: -S(=O)2-
            let isSulfonyl = false;
            for (let c_nei of neiAtom.neighbors) {
                let subAtom = atoms[c_nei.id];
                if (subAtom.element === 'S') {
                    let oCount = 0;
                    for (let s_nei of subAtom.neighbors) {
                        if (atoms[s_nei.id].element === 'O' && s_nei.type === 2) {
                            oCount++;
                        }
                    }
                    if (oCount >= 1) isSulfonyl = true;
                }
            }
            if (isSulfonyl) return true;
            
            // Nitro: -NO2
            let isNitro = false;
            for (let c_nei of neiAtom.neighbors) {
                let subAtom = atoms[c_nei.id];
                if (subAtom.element === 'N') {
                    let oCount = 0;
                    for (let n_nei of subAtom.neighbors) {
                        if (atoms[n_nei.id].element === 'O') {
                            oCount++;
                        }
                    }
                    if (oCount >= 2) isNitro = true;
                }
            }
            if (isNitro) return true;
            
            // Carbonyl of ester, amide, acid halide, etc. (Exclude simple ketones)
            let hasDoubleO = false;
            let hasSingleHetero = false;
            for (let c_nei of neiAtom.neighbors) {
                let subAtom = atoms[c_nei.id];
                if (subAtom.id === cIdx) continue; // Skip alpha carbon
                
                if (subAtom.element === 'O' || subAtom.element === 'N' || subAtom.element === 'S') {
                    if (c_nei.type === 2) {
                        hasDoubleO = true;
                    } else if (c_nei.type === 1) {
                        hasSingleHetero = true;
                    }
                } else if (subAtom.element === 'F' || subAtom.element === 'CL' || subAtom.element === 'BR' || subAtom.element === 'I') {
                    hasSingleHetero = true;
                }
            }
            if (hasDoubleO && hasSingleHetero) {
                return true;
            }
            
            // Triple bond: -C#C-
            let isTripleC = false;
            for (let c_nei of neiAtom.neighbors) {
                if (atoms[c_nei.id].element === 'C' && c_nei.type === 3) {
                    isTripleC = true;
                }
            }
            if (isTripleC) return true;
            
            // Double bond: -CH=CH- linked to aromatic or carbonyl (Michael acceptor)
            let hasDoubleC = false;
            let doubleCIdx = null;
            for (let c_nei of neiAtom.neighbors) {
                if (atoms[c_nei.id].element === 'C' && c_nei.type === 2) {
                    hasDoubleC = true;
                    doubleCIdx = c_nei.id;
                }
            }
            if (hasDoubleC && doubleCIdx !== null) {
                let doubleCAtom = atoms[doubleCIdx];
                for (let dc_nei of doubleCAtom.neighbors) {
                    let dc_subAtom = atoms[dc_nei.id];
                    if (dc_subAtom.isAromatic) {
                        return true;
                    }
                    if (dc_subAtom.element === 'C') {
                        let hasCarbonyl = dc_subAtom.neighbors.some(n => atoms[n.id].element === 'O' && n.type === 2);
                        if (hasCarbonyl) {
                            return true;
                        }
                    }
                }
                if (doubleCAtom.isAromatic) return true;
            }
        }
    }
    return false;
}

/**
 * Checks if there is a hydroxyl group bonded to a beta carbon.
 */
function hasHydroxylOnBeta(atoms, cIdx) {
    const cAtom = atoms[cIdx];
    for (let nei of cAtom.neighbors) {
        let betaAtom = atoms[nei.id];
        if (betaAtom.element === 'C') {
            // Ensure SP3 beta carbon (no double/triple bonds)
            let hasDoubleOrTriple = betaAtom.neighbors.some(n => n.type > 1);
            if (hasDoubleOrTriple) continue;
            
            // Check for OH neighbor
            for (let b_nei of betaAtom.neighbors) {
                let betaNeiAtom = atoms[b_nei.id];
                if (betaNeiAtom.element === 'O') {
                    // Check if OH
                    let heavyNeighbors = 0;
                    for (let o_nei of betaNeiAtom.neighbors) {
                        if (atoms[o_nei.id].element !== 'H') {
                            heavyNeighbors++;
                        }
                    }
                    if (heavyNeighbors === 1) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
}

/**
 * Checks if there is an aryl group bonded to the alpha carbon.
 */
function hasArylOnAlpha(atoms, cIdx) {
    const cAtom = atoms[cIdx];
    if (cAtom.isAromatic) return false;
    
    const cycles = findAllCycles(atoms, 7);
    for (let nei of cAtom.neighbors) {
        let neiIdx = nei.id;
        for (let cycle of cycles) {
            // Neighbor is in cycle, but alpha carbon is not
            if (cycle.includes(neiIdx) && !cycle.includes(cIdx)) {
                // All atoms in this cycle are aromatic
                let allAromatic = cycle.every(idx => atoms[idx].isAromatic);
                if (allAromatic) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Checks if there is a methyl group bonded to a beta carbon with exactly 1 hydrogen.
 */
function hasMethylOnBeta(atoms, cIdx) {
    const cAtom = atoms[cIdx];
    for (let nei of cAtom.neighbors) {
        let betaAtom = atoms[nei.id];
        if (betaAtom.element === 'C') {
            let betaH = getHydrogenCount(atoms, betaAtom.id);
            if (betaH === 1) {
                for (let b_nei of betaAtom.neighbors) {
                    let subAtom = atoms[b_nei.id];
                    if (subAtom.id === cIdx) continue; // Skip alpha carbon
                    
                    if (subAtom.element === 'C') {
                        let subH = getHydrogenCount(atoms, subAtom.id);
                        if (subH === 3) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}

/**
 * Checks if the alpha carbon is a tertiary alpha carbon (hybridization SP3 and connected to 3 carbons).
 */
function isTertiaryCarbon(atoms, cIdxs) {
    for (let cIdx of cIdxs) {
        let cAtom = atoms[cIdx];
        let carbonNeighborCount = 0;
        for (let nei of cAtom.neighbors) {
            if (atoms[nei.id].element === 'C') {
                carbonNeighborCount++;
            }
        }
        if (carbonNeighborCount === 3) {
            return true;
        }
    }
    return false;
}

/**
 * Identifies nitrosamine patterns in the parsed molecular graph.
 */
function findNitrosaminePatterns(atoms) {
    const matches = [];
    for (let atom of atoms) {
        if (atom.element !== 'N') continue;
        
        let neighbors = atom.neighbors;
        if (neighbors.length !== 3) continue; // Degree must be 3
        
        let n2_neighbor = null;
        let carbon_neighbors = [];
        for (let nei of neighbors) {
            let neiAtom = atoms[nei.id];
            if (neiAtom.element === 'N') {
                n2_neighbor = neiAtom;
            } else if (neiAtom.element === 'C') {
                carbon_neighbors.push(neiAtom);
            }
        }
        
        if (!n2_neighbor || carbon_neighbors.length !== 2) continue;
        
        // Nitrosamine check: N2 neighbor double-bonded to an oxygen
        let hasDoubleBondedO = false;
        for (let n2_nei of n2_neighbor.neighbors) {
            let n2_neiAtom = atoms[n2_nei.id];
            if (n2_neiAtom.element === 'O' && n2_nei.type === 2) {
                hasDoubleBondedO = true;
                break;
            }
        }
        if (!hasDoubleBondedO) continue;
        
        // Heteroatom double bond on alpha carbons exclusion
        let doubleBondedToHeteroatom = false;
        for (let c of carbon_neighbors) {
            for (let c_nei of c.neighbors) {
                let c_neiAtom = atoms[c_nei.id];
                if (c_neiAtom.element !== 'C' && c_neiAtom.element !== 'H') {
                    if (c_nei.type === 2) {
                        doubleBondedToHeteroatom = true;
                        break;
                    }
                }
            }
            if (doubleBondedToHeteroatom) break;
        }
        
        if (doubleBondedToHeteroatom) continue;
        
        matches.push({
            nIdx: atom.id,
            cIdxs: carbon_neighbors.map(c => c.id)
        });
    }
    return matches;
}

/**
 * Main CPCA calculation function that mimics the Novartis python algorithm.
 */
function calculateCPCA(smiles) {
    let atoms;
    try {
        atoms = parseSmiles(smiles);
    } catch (e) {
        return {
            success: false,
            error: "SMILES 파싱 오류: " + e.message,
            category: 5,
            score: null,
            ai: "1500 ng/day 이상",
            messages: ["유효하지 않은 SMILES 코드이거나 파싱 불가능한 구조입니다."]
        };
    }
    
    const patterns = findNitrosaminePatterns(atoms);
    if (patterns.length === 0) {
        return {
            success: false,
            error: "니트로사민 패턴 검출 불가",
            category: 5,
            score: null,
            ai: "1500 ng/day 이상",
            messages: ["분자 구조 내에서 N-N=O (니트로사민) 기본 패턴을 검출하지 못했습니다."]
        };
    }
    
    const alpha_Hydrogen_Score = {
        '0,2': 3,
        '0,3': 2,
        '1,2': 3,
        '1,3': 3,
        '2,2': 1,
        '2,3': 1
    };
    
    const results = [];
    
    for (let pat of patterns) {
        const N_index = pat.nIdx;
        const alpha_carbon = pat.cIdxs;
        const messages = ["니트로사민 활성 그룹 검출 (N-N=O)"];
        let score = null;
        
        // Count alpha hydrogens
        const hydrogen_pattern = alpha_carbon.map(cIdx => getHydrogenCount(atoms, cIdx));
        const sortedPattern = [...hydrogen_pattern].sort((a,b) => a-b);
        const patternKey = sortedPattern.join(',');
        
        let greater_zero_hydrogen_counts = 0;
        let greater_one_hydrogen_counts = 0;
        for (let h_num of hydrogen_pattern) {
            if (h_num > 0) greater_zero_hydrogen_counts++;
            if (h_num > 1) greater_one_hydrogen_counts++;
        }
        
        let valid = true;
        
        if (greater_zero_hydrogen_counts === 0) {
            messages.append ? messages.push("양쪽 α-탄소 모두 수소를 가지고 있지 않습니다.") : messages.push("양쪽 α-탄소 모두 수소를 가지고 있지 않습니다.");
            valid = false;
        } else if (greater_one_hydrogen_counts === 0) {
            messages.push("두 개 이상의 α-수소를 가진 α-탄소가 존재하지 않습니다.");
            valid = false;
        } else if (isTertiaryCarbon(atoms, alpha_carbon)) {
            messages.push("3차 α-탄소(Tertiary alpha-carbon)가 존재합니다. (수소 없음, 3개의 탄소 결합)");
            valid = false;
        }
        
        if (valid) {
            messages.push("CPCA 전위성(Potency) 평가 시작");
            
            // Check base score
            if (alpha_Hydrogen_Score[patternKey] !== undefined) {
                score = alpha_Hydrogen_Score[patternKey];
                let desc = `각 α-탄소의 수소 개수 조합 [${sortedPattern.join(', ')}] -> 기본 α-수소 점수: +${score}점`;
                
                // Ethyl rule exception
                if (patternKey === '0,2') {
                    let hasEthyl = false;
                    for (let carbon_idx of alpha_carbon) {
                        let carbon_h = getHydrogenCount(atoms, carbon_idx);
                        if (carbon_h === 2) {
                            // This is the methylene alpha carbon, check if it's part of an ethyl group
                            for (let sub_carb of atoms[carbon_idx].neighbors) {
                                let subAtom = atoms[sub_carb.id];
                                if (subAtom.element === 'C' && subAtom.id !== N_index) {
                                    let sub_h = getHydrogenCount(atoms, sub_carb.id);
                                    if (sub_h === 3) {
                                        hasEthyl = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (hasEthyl) {
                        score = 2;
                        desc = `각 α-탄소의 수소 개수 조합 [${sortedPattern.join(', ')}] 이며, 메틸렌 α-탄소가 에틸기(Ethyl)의 일부임 -> 감산 적용된 α-수소 점수: +2점`;
                    }
                }
                messages.push(desc);
            } else {
                // If it is [3,3] or other invalid pattern
                score = null;
                messages.push(`조합 [${sortedPattern.join(', ')}]은 CPCA 전위 영역 표에 존재하지 않는 특수 패턴입니다.`);
            }
            
            if (score !== null) {
                // 3. Deactivating features (가산)
                
                // Carboxylic acid
                if (hasCarboxylicAcid(atoms)) {
                    score += 3;
                    messages.push("카르복실산(Carboxylic Acid) 그룹 검출: 비활성화 인자 +3점 가산");
                }
                
                // Ring related
                const ringScore = getRingRelatedScore(atoms, N_index);
                if (ringScore > 0) {
                    score += ringScore;
                    let ringDesc = `고리 구조 검출 (크기/특성): 비활성화 인자 +${ringScore}점 가산`;
                    if (ringScore === 3 && isInPyrrolidine(atoms, N_index, findCyclesContaining(atoms, N_index, 7))) {
                        ringDesc += " (피롤리딘 고리 포함 예외 적용)";
                    } else if (ringScore === 1 && isInMorpholine(atoms, N_index, findCyclesContaining(atoms, N_index, 7))) {
                        ringDesc += " (모폴린 고리 포함 예외 적용)";
                    } else if (ringScore === 3) {
                        ringDesc += " (황(S) 포함 6원 고리 예외 적용)";
                    }
                    messages.push(ringDesc);
                }
                
                // Chains of >= 5 non-H atoms on both sides
                if (fiveConsecAtomsScore(atoms, N_index, alpha_carbon) > 0) {
                    score += 1;
                    messages.push("양측 모두 연속 5개 이상의 비수소 원자 사슬(cyclic/acyclic) 존재: 비활성화 인자 +1점 가산");
                }
                
                // EWG on alpha carbon
                for (let k of alpha_carbon) {
                    if (isEwgOnAlpha(atoms, N_index, k)) {
                        score += 1;
                        messages.push(`α-탄소(위치 번호 ${k+1})에 전자끌림기(EWG) 결합: 비활성화 인자 +1점 가산`);
                    }
                }
                
                // Hydroxyl on beta carbon
                for (let k of alpha_carbon) {
                    if (hasHydroxylOnBeta(atoms, k)) {
                        score += 1;
                        messages.push(`β-탄소에 하이드록실기(-OH) 결합: 비활성화 인자 +1점 가산`);
                    }
                }
                
                // 4. Activating features (감산)
                
                // Aryl on alpha
                let hasAryl = false;
                for (let k of alpha_carbon) {
                    if (hasArylOnAlpha(atoms, k)) {
                        hasAryl = true;
                        break;
                    }
                }
                if (hasAryl) {
                    score -= 1;
                    messages.push("α-탄소에 아릴기(Aryl) 결합: 활성화 인자 -1점 감산 (1회만 적용)");
                }
                
                // Methyl on beta
                let hasBetaMethyl = false;
                for (let k of alpha_carbon) {
                    if (hasMethylOnBeta(atoms, k)) {
                        hasBetaMethyl = true;
                        break;
                    }
                }
                if (hasBetaMethyl) {
                    score -= 1;
                    messages.push("β-탄소에 메틸기 결합(1H 보유 β-탄소): 활성화 인자 -1점 감산 (1회만 적용)");
                }
            }
        }
        
        results.push({
            score: score,
            messages: messages
        });
    }
    
    // Evaluate final score ( Novartis code handles multiple nitrosamine patterns by taking the minimum score )
    let finalScore = null;
    let finalMessages = [];
    
    if (results.length === 1) {
        finalScore = results[0].score;
        finalMessages = results[0].messages;
    } else {
        // Multi-nitrosamine
        const scoreList = results.map(r => r.score === null ? 100 : r.score);
        const minScoreVal = Math.min(...scoreList);
        const minIdx = scoreList.indexOf(minScoreVal);
        
        finalScore = minScoreVal === 100 ? null : minScoreVal;
        finalMessages = results[minIdx].messages;
        finalMessages.unshift(`분자 내 총 ${results.length}개의 니트로사민 패턴 검출. 가장 민감한(가장 낮은 점수) 패턴 기준 산정.`);
    }
    
    // Category mapping
    let category = 5;
    let ai = "1500 ng/day 이상";
    
    if (finalScore === null) {
        category = 5;
        ai = "1500 ng/day 이상";
    } else if (finalScore <= 1) {
        category = 1;
        ai = "26.5 ng/day";
    } else if (finalScore === 2) {
        category = 2;
        ai = "100 ng/day";
    } else if (finalScore === 3) {
        category = 3;
        ai = "400 ng/day";
    } else if (finalScore >= 4) {
        category = 4;
        ai = "1500 ng/day";
    }
    
    // Check if compound-specific AI exists (MFDS / EMA / FDA published standards)
    const cleanInput = smiles.replace(/[\[\]@\s\-]/g, '').toUpperCase();
    const COMPOUND_SPECIFIC_LIST = [
        { name: "NDMA (N-Nitrosodimethylamine)", smiles: "CN(C)N=O", ai: "96 ng/day", ref: "식약처/EMA/FDA 기준" },
        { name: "NDEA (N-Nitrosodiethylamine)", smiles: "CCN(CC)N=O", ai: "26.5 ng/day", ref: "식약처/EMA/FDA 기준" },
        { name: "NDIPA (N-Nitrosodiisopropylamine)", smiles: "CC(C)N(C(C)C)N=O", ai: "26.5 ng/day", ref: "식약처/EMA/FDA 기준" },
        { name: "NEIPA (N-Nitrosoethylisopropylamine)", smiles: "CCN(C(C)C)N=O", ai: "26.5 ng/day", ref: "식약처/EMA/FDA 기준" },
        { name: "NDBA (N-Nitrosodibutylamine)", smiles: "CCCCN(CCCC)N=O", ai: "26.5 ng/day", ref: "식약처/EMA/FDA 기준" },
        { name: "NPIP (N-Nitrosopiperidine)", smiles: "O=NN1CCCCC1", ai: "60 ng/day", ref: "식약처/EMA/FDA 기준" },
        { name: "NPYR (N-Nitrosopyrrolidine)", smiles: "O=NN1CCCC1", ai: "17 ng/day", ref: "식약처/EMA/FDA 기준" },
        { name: "NMOR (N-Nitrosomorpholine)", smiles: "O=NN1CCOCC1", ai: "127 ng/day", ref: "식약처/EMA/FDA 기준" },
        { name: "NDELA (N-Nitrosodiethanolamine)", smiles: "OCCN(CCO)N=O", ai: "1900 ng/day", ref: "식약처/EMA/FDA 기준" }
    ];

    let compoundSpecific = null;
    for (let item of COMPOUND_SPECIFIC_LIST) {
        if (item.smiles.replace(/[\[\]@\s\-]/g, '').toUpperCase() === cleanInput) {
            compoundSpecific = item;
            break;
        }
    }
    
    return {
        success: true,
        category: category,
        score: finalScore,
        ai: ai,
        messages: finalMessages,
        patternsCount: patterns.length,
        compoundSpecific: compoundSpecific
    };
}

// Export for node or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseSmiles, calculateCPCA };
} else {
    window.calculateCPCA = calculateCPCA;
}
