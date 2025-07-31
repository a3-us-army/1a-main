import { Router } from "express";
import { parse } from "csv-parse/sync";
import fetch from "node-fetch";

const router = Router();

// Function to categorize personnel based on their position
function categorizePersonnel(personnel) {
  const categories = {
    command: {
      units: []
    },
    "platoon #1": {
      units: []
    },
    "support elements": {
      units: []
    }
  };

  // Create organizational units first
  const organizationalUnits = [
    "Alpha Company Headquarters",
    "1st Platoon, Alpha Company",
    "1st Platoon, 1st Squad (Assault 1)",
    "1st Platoon, 2nd Squad (Assault 2)", 
    "1st Platoon, 3rd Squad (Security)",
    "1st Platoon, 4th Squad (Weapons)",
    "Alpha Company Fires Cell",
    "Delta Company, Battalion Mortars",
    "Delta Company, Sniper Section",
    "Inactive Reserves, Infantry"
  ];

  // Add units to appropriate categories
  organizationalUnits.forEach(unitName => {
    if (unitName.includes("Alpha Company Headquarters") || unitName.includes("1st Platoon, Alpha Company")) {
      categories.command.units.push({
        name: unitName,
        personnel: []
      });
    } else if (unitName.includes("1st Platoon") && unitName.includes("Squad")) {
      categories["platoon #1"].units.push({
        name: unitName,
        personnel: []
      });
    } else {
      categories["support elements"].units.push({
        name: unitName,
        personnel: []
      });
    }
  });

  // Now assign personnel to their respective units
  personnel.forEach(person => {
    const position = person.position?.toLowerCase() || "";
    const callsign = person.callsign?.toLowerCase() || "";
    
    // Skip empty positions
    if (!position || position.trim() === "") {
      return;
    }

    // Command personnel - Company level
    if (position.includes("a co. cmdr") ||
        position.includes("a co. xo") ||
        position.includes("a co. 1sg")) {
      const hqUnit = categories.command.units.find(unit => 
        unit.name.toLowerCase().includes("alpha company headquarters"));
      if (hqUnit) {
        hqUnit.personnel.push(person);
      }
    }
    // Platoon leadership
    else if (position.includes("platoon leader") ||
             position.includes("platoon sergeant") ||
             position.includes("platoon medic") ||
             position.includes("platoon rto")) {
      const platoonUnit = categories.command.units.find(unit => 
        unit.name.toLowerCase().includes("1st platoon, alpha company"));
      if (platoonUnit) {
        platoonUnit.personnel.push(person);
      }
    }
    // Support personnel - Fires Cell
    else if (position.includes("17th sts tacp") || position.includes("fo")) {
      const firesUnit = categories["support elements"].units.find(unit => 
        unit.name.toLowerCase().includes("alpha company fires cell"));
      if (firesUnit) {
        firesUnit.personnel.push(person);
      }
    }
    // Support personnel - Mortars
    else if (position.includes("mortar")) {
      const mortarUnit = categories["support elements"].units.find(unit => 
        unit.name.toLowerCase().includes("battalion mortars"));
      if (mortarUnit) {
        mortarUnit.personnel.push(person);
      }
    }
    // Support personnel - Sniper
    else if (position.includes("team") && (position.includes("tl") || position.includes("spotter"))) {
      const sniperUnit = categories["support elements"].units.find(unit => 
        unit.name.toLowerCase().includes("sniper section"));
      if (sniperUnit) {
        sniperUnit.personnel.push(person);
      }
    }
    // Support personnel - Reserves
    else if (position.includes("saw gunner") || position.includes("grenadier")) {
      const reservesUnit = categories["support elements"].units.find(unit => 
        unit.name.toLowerCase().includes("inactive reserves"));
      if (reservesUnit) {
        reservesUnit.personnel.push(person);
      }
    }
    // Squad personnel - assign based on callsign patterns
    else if (callsign) {
      let assigned = false;
      
      if (callsign.includes("ka11")) {
        const squad1 = categories["platoon #1"].units.find(unit => 
          unit.name.toLowerCase().includes("1st squad"));
        if (squad1) {
          squad1.personnel.push(person);
          assigned = true;
        }
      } else if (callsign.includes("ka12")) {
        const squad2 = categories["platoon #1"].units.find(unit => 
          unit.name.toLowerCase().includes("2nd squad"));
        if (squad2) {
          squad2.personnel.push(person);
          assigned = true;
        }
      } else if (callsign.includes("ka13")) {
        const squad3 = categories["platoon #1"].units.find(unit => 
          unit.name.toLowerCase().includes("3rd squad"));
        if (squad3) {
          squad3.personnel.push(person);
          assigned = true;
        }
      } else if (callsign.includes("ka14")) {
        const squad4 = categories["platoon #1"].units.find(unit => 
          unit.name.toLowerCase().includes("4th squad"));
        if (squad4) {
          squad4.personnel.push(person);
          assigned = true;
        }
      }
      
      // If not assigned by callsign but has a squad-related position, distribute across squads
      if (!assigned && (position.includes("squad") || position.includes("team") || position.includes("saw") || position.includes("rifleman") || position.includes("240") || position.includes("at") || position.includes("carl"))) {
        // Try to assign based on position patterns
        if (position.includes("squad leader")) {
          // Squad leaders should be assigned to their respective squads based on position
          if (position.toLowerCase().includes("1st") || position.toLowerCase().includes("first")) {
            const squad1 = categories["platoon #1"].units.find(unit => 
              unit.name.toLowerCase().includes("1st squad"));
            if (squad1) squad1.personnel.push(person);
          } else if (position.toLowerCase().includes("2nd") || position.toLowerCase().includes("second")) {
            const squad2 = categories["platoon #1"].units.find(unit => 
              unit.name.toLowerCase().includes("2nd squad"));
            if (squad2) squad2.personnel.push(person);
          } else if (position.toLowerCase().includes("3rd") || position.toLowerCase().includes("third")) {
            const squad3 = categories["platoon #1"].units.find(unit => 
              unit.name.toLowerCase().includes("3rd squad"));
            if (squad3) squad3.personnel.push(person);
          } else if (position.toLowerCase().includes("4th") || position.toLowerCase().includes("fourth")) {
            const squad4 = categories["platoon #1"].units.find(unit => 
              unit.name.toLowerCase().includes("4th squad"));
            if (squad4) squad4.personnel.push(person);
          }
        } else {
          // For other positions, distribute evenly across squads based on position content
          const allSquads = categories["platoon #1"].units.filter(unit => 
            unit.name.toLowerCase().includes("squad"));
          
          if (allSquads.length > 0) {
            // Simple distribution based on position hash
            const positionHash = position.toLowerCase().split('').reduce((a, b) => {
              a = ((a << 5) - a) + b.charCodeAt(0);
              return a & a;
            }, 0);
            const squadIndex = Math.abs(positionHash) % allSquads.length;
            allSquads[squadIndex].personnel.push(person);
          }
        }
      }
    }
  });

  return categories;
}

router.get("/", async (req, res) => {
	let isAdmin = false;
	if (req.user) {
		isAdmin = await import("../utils/discord.js").then((m) =>
			m.isUserAdmin(req.user.id)
		);
	}
	res.render("personnel", {
		user: req.user,
		active: "dashboard",
		isAdmin,
	});
});


router.get("/api/personnel", async (req, res) => {
  try {
    const sheetUrl =
      "https://docs.google.com/spreadsheets/d/11b5ZnMwxw3qj66q3-PMy0YHFOn5Th_I-NnsJH5cRrF4/export?format=csv&gid=9697998";
    const response = await fetch(sheetUrl);
    const csv = await response.text();

    const rows = parse(csv, { skip_empty_lines: false, trim: true });

    // Find the header row
    const headerRowIdx = rows.findIndex(
      (row) =>
        row[0]?.toLowerCase().includes("position") &&
        row[1]?.toLowerCase().includes("callsign") &&
        row[2]?.toLowerCase().includes("status") &&
        row[3]?.toLowerCase().includes("name")
    );

    if (headerRowIdx === -1) {
      return res
        .status(500)
        .json({ error: "Could not find header row in personnel sheet" });
    }

    const headers = rows[headerRowIdx].map((h) => h.trim());
    const personnel = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every((cell) => !cell || cell.trim() === "")) continue;
      const person = {};
      for (let j = 0; j < headers.length; j++) {
        person[headers[j].toLowerCase()] = row[j] ? row[j].trim() : "";
      }
      personnel.push(person);
    }

    // Log the personnel array to the console
    console.log("Personnel data:", JSON.stringify(personnel, null, 2));

    res.json(personnel);
  } catch (e) {
    console.error("Failed to fetch personnel from Google Sheets:", e);
    res.status(500).json({ error: "Failed to fetch personnel data" });
  }
});

export default router;