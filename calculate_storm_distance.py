import geopandas as gpd
import pickle
from shapely.geometry import LineString
import pandas as pd


def calculate_storm_distances():
    print("Loading data...")
    # Load the processed geodata
    with open("processed_geodata.pkl", "rb") as f:
        data = pickle.load(f)
    
    amphan_gdf = data["amphan_gdf"]
    bangladesh_gdf = gpd.read_file(
        "bangladesh_classified_with_children.geojson"
    )
    
    # Create a LineString from the storm track points
    storm_track = LineString(amphan_gdf.geometry.tolist())
    
    print("Calculating distances...")
    # Convert to UTM Zone 45N (EPSG:32645) for accurate calculations
    bangladesh_utm = bangladesh_gdf.to_crs(epsg=32645)
    storm_track_utm = gpd.GeoDataFrame(
        geometry=[storm_track], 
        crs='EPSG:4326'
    ).to_crs(epsg=32645)
    
    # Calculate centroids in UTM projection for each sub-district
    bangladesh_utm['subdistrict_center'] = bangladesh_utm.geometry.centroid
    
    # Calculate distances in kilometers
    distances = []
    for center in bangladesh_utm['subdistrict_center']:
        # Calculate distance and convert to km
        dist = center.distance(storm_track_utm.geometry[0]) / 1000
        distances.append(dist)
    
    bangladesh_gdf['distance_to_storm_km'] = distances
    
    # Add a categorical distance classification
    bangladesh_gdf['storm_distance_class'] = pd.cut(
        bangladesh_gdf['distance_to_storm_km'],
        bins=[0, 50, 100, 200, float('inf')],
        labels=['Very Close', 'Close', 'Moderate', 'Far'],
        include_lowest=True
    )
    
    print("Saving results...")
    # Save the updated GeoJSON
    bangladesh_gdf.to_file(
        "bangladesh_classified_with_children.geojson", 
        driver="GeoJSON"
    )
    
    # Print summary statistics
    print("\nDistance to Storm Track Summary:")
    print(bangladesh_gdf['distance_to_storm_km'].describe())
    
    print("\nDistance Classification Distribution:")
    print(bangladesh_gdf['storm_distance_class'].value_counts())
    
    print("\nTop 5 Closest Sub-districts to Storm Track:")
    cols = ['NAME_4', 'distance_to_storm_km', 'storm_distance_class']
    print(
        bangladesh_gdf[cols]
        .sort_values('distance_to_storm_km')
        .head()
    )


if __name__ == "__main__":
    calculate_storm_distances() 