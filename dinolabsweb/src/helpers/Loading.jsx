import React from "react";
import "../styles/helperStyles/LoadingSpinner.css";

const DinoLabsLoading = () => {
    return (
        <div className="loading-container">
            <div className="loading-wrapper">
                <div className="loading-circle" />
                <label className="loading-title">Loading</label>
            </div>
        </div>
    );
}; 

export default DinoLabsLoading; 