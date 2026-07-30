// Demo dealership config. In the full build this becomes a tenant row in Postgres;
// for the pilot demo it's a single hardcoded store.
// Phone numbers are placeholders — swap in the real department lines before the demo
// if you want transfer_to_human to hand back real numbers.

export type Department = "sales" | "service" | "parts";

export interface DepartmentConfig {
  label: string;
  transferNumber: string;
  hours: string;
}

export const dealership = {
  name: "Kia of Smyrna",
  address: "2500 South Cobb Drive, Smyrna, Georgia 30080",
  timezone: "America/New_York",
  directions:
    "We're on South Cobb Drive just south of the East-West Connector, about ten minutes from downtown Smyrna.",
  departments: {
    sales: {
      label: "Sales",
      transferNumber: "+17705550101",
      hours: "Monday through Saturday 9 AM to 8 PM, closed Sunday",
    },
    service: {
      label: "Service",
      transferNumber: "+17705550102",
      hours: "Monday through Friday 7 AM to 6 PM, Saturday 8 AM to 4 PM, closed Sunday",
    },
    parts: {
      label: "Parts",
      transferNumber: "+17705550103",
      hours: "Monday through Friday 7:30 AM to 6 PM, Saturday 8 AM to 4 PM, closed Sunday",
    },
  } satisfies Record<Department, DepartmentConfig>,
};

export function getDepartment(name: string): DepartmentConfig {
  const key = name.toLowerCase().trim() as Department;
  return dealership.departments[key] ?? dealership.departments.sales;
}
