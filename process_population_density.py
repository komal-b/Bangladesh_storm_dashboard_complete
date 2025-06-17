import pandas as pd
import geopandas as gpd
from shapely.geometry import Point


def process_population_by_district():
    print("Loading district boundaries...")
    # Read the existing classified data
    bangladesh_gdf = gpd.read_file("bangladesh_classified.geojson")
    
    print("Processing population data in chunks...")
    # Read CSV in chunks due to its large size
    chunk_size = 100000
    chunks = pd.read_csv(
        "bgd_children_under_five_2020.csv", 
        chunksize=chunk_size
    )
    
    # Dictionary to store sub-district-wise population
    subdistrict_population = {
        subdistrict: 0 for subdistrict in bangladesh_gdf['NAME_4'].unique()
    }
    
    chunk_count = 0
    for chunk in chunks:
        chunk_count += 1
        if chunk_count % 10 == 0:
            print(f"Processed {chunk_count} chunks...")
            
        # Create GeoDataFrame from the chunk
        geometry = [
            Point(xy) for xy in zip(chunk['longitude'], chunk['latitude'])
        ]
        chunk_gdf = gpd.GeoDataFrame(
            chunk, 
            geometry=geometry, 
            crs="EPSG:4326"
        )
        
        # Spatial join with sub-districts
        joined = gpd.sjoin(
            chunk_gdf, 
            bangladesh_gdf, 
            how='left', 
            predicate='within'
        )
        
        # Sum population by sub-district
        pop_col = 'bgd_children_under_five_2020'
        subdistrict_sums = joined.groupby('NAME_4')[pop_col].sum()
        
        # Update the sub-district population dictionary
        for subdistrict, pop in subdistrict_sums.items():
            if subdistrict in subdistrict_population:
                subdistrict_population[subdistrict] += pop

    print("Adding population data to sub-districts...")
    # Add the population data to the bangladesh_gdf
    bangladesh_gdf['children_under_five'] = bangladesh_gdf['NAME_4'].map(
        subdistrict_population
    ).round().astype(int)

    # Calculate area in square kilometers
    print("Calculating population density...")
    # Convert to km²
    bangladesh_gdf['area_km2'] = (
        bangladesh_gdf.to_crs('EPSG:32645').area / 1000000
    )
    bangladesh_gdf['children_density_km2'] = (
        bangladesh_gdf['children_under_five'] / bangladesh_gdf['area_km2']
    )

    # Save the updated GeoJSON
    print("Saving results...")
    output_file = "bangladesh_classified_with_children.geojson"
    bangladesh_gdf.to_file(output_file, driver="GeoJSON")
    
    # Print summary statistics
    print("\nSub-district-level Children Population Summary:")
    summary_cols = ['NAME_4', 'children_under_five', 'children_density_km2']
    print(bangladesh_gdf[summary_cols].describe())
    
    print("\nTop 5 Sub-districts by Children Population Density:")
    print(
        bangladesh_gdf[summary_cols]
        .sort_values('children_density_km2', ascending=False)
        .head()
    )
    
    print(f"\nResults saved to {output_file}")


if __name__ == "__main__":
    process_population_by_district() 