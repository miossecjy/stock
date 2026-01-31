import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getPortfolios, createPortfolio, updatePortfolio, deletePortfolio } from "../lib/api";
import { useAuth } from "./AuthContext";

const PortfolioContext = createContext(null);

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error("usePortfolio must be used within a PortfolioProvider");
  }
  return context;
};

// Portfolio icons mapping
export const PORTFOLIO_ICONS = [
  { id: "briefcase", label: "Briefcase" },
  { id: "piggy-bank", label: "Piggy Bank" },
  { id: "trending-up", label: "Growth" },
  { id: "bitcoin", label: "Crypto" },
  { id: "home", label: "Real Estate" },
  { id: "graduation-cap", label: "Education" },
  { id: "car", label: "Vehicle" },
  { id: "plane", label: "Travel" },
  { id: "shield", label: "Insurance" },
  { id: "gift", label: "Gifts" },
];

// Portfolio colors
export const PORTFOLIO_COLORS = [
  { id: "#7c3aed", label: "Purple" },
  { id: "#22c55e", label: "Green" },
  { id: "#3b82f6", label: "Blue" },
  { id: "#f59e0b", label: "Orange" },
  { id: "#ef4444", label: "Red" },
  { id: "#ec4899", label: "Pink" },
  { id: "#14b8a6", label: "Teal" },
  { id: "#8b5cf6", label: "Violet" },
];

export const PortfolioProvider = ({ children }) => {
  const { user } = useAuth();
  const [portfolios, setPortfolios] = useState([]);
  const [activePortfolio, setActivePortfolio] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPortfolios = useCallback(async () => {
    if (!user) {
      setPortfolios([]);
      setActivePortfolio(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await getPortfolios();
      const portfolioList = response.data;
      setPortfolios(portfolioList);
      
      // Set active portfolio from localStorage or use default
      const savedActiveId = localStorage.getItem("activePortfolioId");
      const savedPortfolio = portfolioList.find(p => p.id === savedActiveId);
      const defaultPortfolio = portfolioList.find(p => p.is_default);
      
      setActivePortfolio(savedPortfolio || defaultPortfolio || portfolioList[0] || null);
    } catch (error) {
      console.error("Failed to fetch portfolios:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  // Save active portfolio to localStorage
  useEffect(() => {
    if (activePortfolio) {
      localStorage.setItem("activePortfolioId", activePortfolio.id);
    }
  }, [activePortfolio]);

  const addPortfolio = async (data) => {
    const response = await createPortfolio(data);
    const newPortfolio = response.data;
    setPortfolios(prev => [...prev, newPortfolio]);
    return newPortfolio;
  };

  const editPortfolio = async (id, data) => {
    const response = await updatePortfolio(id, data);
    const updatedPortfolio = response.data;
    setPortfolios(prev => prev.map(p => p.id === id ? updatedPortfolio : p));
    if (activePortfolio?.id === id) {
      setActivePortfolio(updatedPortfolio);
    }
    return updatedPortfolio;
  };

  const removePortfolio = async (id) => {
    await deletePortfolio(id);
    setPortfolios(prev => prev.filter(p => p.id !== id));
    
    // If deleted portfolio was active, switch to default
    if (activePortfolio?.id === id) {
      const defaultPortfolio = portfolios.find(p => p.is_default && p.id !== id);
      setActivePortfolio(defaultPortfolio || portfolios[0] || null);
    }
  };

  const selectPortfolio = (portfolio) => {
    setActivePortfolio(portfolio);
  };

  const selectAllPortfolios = () => {
    setActivePortfolio(null); // null means show all portfolios
  };

  return (
    <PortfolioContext.Provider
      value={{
        portfolios,
        activePortfolio,
        loading,
        fetchPortfolios,
        addPortfolio,
        editPortfolio,
        removePortfolio,
        selectPortfolio,
        selectAllPortfolios,
        isAllSelected: activePortfolio === null,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
};
